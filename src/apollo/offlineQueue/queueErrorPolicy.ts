import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
} from '@apollo/client/errors';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';
import { isErrorTypename } from '#/utils/errors/mutationPayload';
import type { QueueError } from './types';

/**
 * A replayed mutation resolved with an error union member — a refusal. Carries
 * the payload's `__typename` and `code` so {@link classifyError} decides from
 * those, never from the free-text server message: "subscription expired" run
 * through the string heuristics below becomes an auth error retried forever.
 */
export class ReplayRejectedError extends Error {
  readonly payloadTypename: string;
  readonly payloadCode: string | null;

  constructor(
    payloadTypename: string,
    message: string,
    payloadCode?: string | null,
  ) {
    super(message);
    this.name = 'ReplayRejectedError';
    this.payloadTypename = payloadTypename;
    this.payloadCode = payloadCode ?? null;
  }
}

/**
 * Outcome of a replay that RESOLVED with data: under `errorPolicy: 'all'` a
 * refusal resolves instead of throwing. `'converged'` is a `ConflictError`
 * coded `IDEMPOTENT_REPLAY` — already committed, so dequeue as success. Match
 * on the CODE: a generic `ConflictError` is a real conflict, so `'rejected'`.
 */
export type ReplayOutcome = 'applied' | 'converged' | 'rejected';

export function classifyReplayResult(payload: unknown): ReplayOutcome {
  if (!payload || typeof payload !== 'object') return 'applied';

  const { __typename: typename, code } = payload as {
    __typename?: string;
    code?: string;
  };
  if (!typename || !isErrorTypename(typename)) return 'applied';

  if (typename === 'ConflictError' && code === ErrorCode.IdempotentReplay) {
    return 'converged';
  }
  return 'rejected';
}

/**
 * The API sets codes per-error inside `errors[i]`, while
 * `CombinedGraphQLErrors.extensions` is the RESPONSE-level bag — a flat
 * `extensions.code` read sees `undefined` for every real refusal. Flat shapes
 * are read last: `queueStore` persists `lastError` and replays it back here.
 */
function readErrorCode(error: unknown): string | undefined {
  if (CombinedGraphQLErrors.is(error) || CombinedProtocolErrors.is(error)) {
    // First code wins: the queue needs one classification, and the branches
    // below are ordered so the most consequential refusal is acted on anyway.
    for (const graphQLError of error.errors) {
      const code = graphQLError.extensions?.code;
      if (typeof code === 'string') return code;
    }
    return undefined;
  }

  const flat = error as
    | { code?: string; extensions?: { code?: string } }
    | null
    | undefined;
  return flat?.extensions?.code ?? flat?.code;
}

/**
 * Apollo 4 throws `ServerError` carrying `statusCode` directly. Reading only
 * the Apollo 3 `networkError.statusCode` nesting kills the 5xx branch, which
 * dequeues a transient outage as a permanent client fault and loses the write.
 */
function readStatusCode(error: unknown): number | undefined {
  if (ServerError.is(error)) return error.statusCode;

  const legacy = error as
    | { networkError?: { statusCode?: number } }
    | null
    | undefined;
  return legacy?.networkError?.statusCode;
}

/**
 * Pure classification of a replay error: `auth` retries after a token refresh,
 * `network`/`server` defer to the next drain, `unknown` fails permanently.
 * Separate from {@link QueueManager}'s stateful retry orchestration so the
 * heuristics are testable in isolation.
 */
export function classifyError(error: unknown): QueueError {
  // Classified by typename/code, never by the server-authored free-text message.
  if (error instanceof ReplayRejectedError) {
    // DEADLOCK is the one ConflictError code the API documents as transient and
    // safe to retry: defer like a server error rather than revert + dequeue.
    if (error.payloadCode === ErrorCode.Deadlock) {
      return {
        type: 'server',
        message: error.message,
        code: ErrorCode.Deadlock,
        timestamp: Date.now(),
        retryable: true,
      };
    }
    return {
      type: 'unknown',
      message: error.message,
      code: error.payloadTypename,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  const err = (error ?? {}) as { message?: string };
  const message = err.message || String(error);
  const code = readErrorCode(error);

  // Build below the server's minimum: deferred, not failed, so the change
  // survives on disk and syncs once the user updates. `retryable: false` skips
  // the in-run loop (every attempt sends the same version) while QueueManager
  // defers `server` regardless of that flag — the combination wanted here.
  if (code === TopLevelErrorCode.ClientUpgradeRequired) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // Neither code is fixable by a token refresh, so both fail permanently, as in
  // errorLink. AUTH_ACCOUNT_SUSPENDED must return HERE rather than fall to the
  // auth branch: server wording containing "unauthorized" would otherwise mark
  // a permanently dead account retryable and spin the queue against it.
  if (code === ErrorCode.Forbidden || code === ErrorCode.AuthAccountSuspended) {
    return {
      type: 'unknown',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // The whole auth family, by CODE only: AUTH_TOKEN_MISSING is exactly what a
  // refresh fixes, and message matching on 'expired'/'unauthorized' pulls in
  // refusals that have nothing to do with the token. The codes a refresh cannot
  // fix are self-limiting — QueueManager runs one proactiveTokenRefresh() per
  // `auth` classification and fails the entry when it comes back empty.
  if (isAuthRefusalCode(code ?? '')) {
    return {
      type: 'auth',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  // 'timed out' as well as 'timeout': the processing-timeout rejects with
  // 'Operation timed out', which does not contain the substring "timeout".
  if (
    message.toLowerCase().includes('network') ||
    message.toLowerCase().includes('timeout') ||
    message.toLowerCase().includes('timed out') ||
    message.toLowerCase().includes('econnrefused')
  ) {
    return {
      type: 'network',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  if ((readStatusCode(error) ?? 0) >= 500) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  // 4xx / GraphQL validation: a client fault, not worth retrying.
  return {
    type: 'unknown',
    message,
    code,
    timestamp: Date.now(),
    retryable: false,
  };
}

/**
 * Exponential backoff with jitter, capped at 30s. `baseDelayMs` is the queue's
 * configured retry delay; delay = min(baseDelayMs * 2^retryCount + jitter, 30s).
 */
export function calculateRetryDelay(
  retryCount: number,
  baseDelayMs: number,
): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, retryCount);
  const jitter = Math.random() * 500; // Prevents a thundering herd.
  return Math.min(exponentialDelay + jitter, 30000);
}
