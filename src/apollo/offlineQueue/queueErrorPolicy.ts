import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
} from '@apollo/client/errors';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';
import { isNetworkError } from '#/utils/isNetworkError';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { VERSION_CONFLICT_CODES } from '#/utils/errors/versionConflict';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import {
  isErrorTypename,
  type MutationErrorTypename,
} from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import type { QueueError } from './types';

/**
 * A replayed mutation resolved with an error union member — a refusal. Carries
 * the payload's `__typename` and `code` so {@link classifyError} decides from
 * those, never from the free-text server message: "subscription expired" run
 * through the string heuristics below becomes an auth error retried forever.
 */
export class ReplayRejectedError extends Error {
  readonly payloadTypename: MutationErrorTypename;
  readonly payloadCode: string | null;
  /**
   * `NotFoundError.resource` — which row was missing. A bare `NotFoundError`
   * cannot be acted on: the pantry item itself being gone and its unit being
   * gone are the same typename and the same code.
   */
  readonly payloadResource: string | null;

  constructor(
    payloadTypename: MutationErrorTypename,
    message: string,
    payloadCode?: string | null,
    payloadResource?: string | null,
  ) {
    super(message);
    this.name = 'ReplayRejectedError';
    this.payloadTypename = payloadTypename;
    this.payloadCode = payloadCode ?? null;
    this.payloadResource = payloadResource ?? null;
  }
}

export const REPLAY_NOT_PREPARED_CODE = 'REPLAY_NOT_PREPARED';

/**
 * The replay could not be BUILT on the device — a value it reads was missing,
 * typically because the persisted cache was discarded while the queue survived.
 * The server never saw the write, so this is a deferral, never a refusal.
 */
export class ReplayNotPreparedError extends Error {
  readonly operationName: string;
  readonly cause: unknown;

  constructor(operationName: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Cannot prepare replay of ${operationName}: ${detail}`);
    this.name = 'ReplayNotPreparedError';
    this.operationName = operationName;
    this.cause = cause;
  }
}

export const BATCH_ROW_TRANSIENT_CODE = 'BATCH_ROW_TRANSIENT';

/** Row codes the API reports for a fault that clears on its own. */
const TRANSIENT_ROW_CODES: readonly string[] = [
  ErrorCode.InternalServerError,
  ErrorCode.Deadlock,
];

/**
 * A batch applied but a row inside `results` failed transiently. The API
 * converges each row on its id, so re-sending the whole entry later is safe;
 * reverting that row would discard a write the server never refused.
 */
export class BatchRowDeferredError extends Error {
  constructor(operationName: string, rowCode: string) {
    super(`${operationName} has a row that failed transiently (${rowCode})`);
    this.name = 'BatchRowDeferredError';
  }
}

/** The first transient code among a batch payload's failed rows, if any. */
export function transientBatchRowCode(payload: unknown): string | null {
  const results: unknown = isRecord(payload) ? payload.results : undefined;
  if (!Array.isArray(results)) return null;
  for (const result of results as unknown[]) {
    if (
      isRecord(result) &&
      result.success === false &&
      typeof result.code === 'string' &&
      TRANSIENT_ROW_CODES.includes(result.code)
    ) {
      return result.code;
    }
  }
  return null;
}

/**
 * Outcome of a replay that RESOLVED with data: under `errorPolicy: 'all'` a
 * refusal resolves instead of throwing. `'converged'` is a `ConflictError`
 * coded `IDEMPOTENT_REPLAY` — already committed, so dequeue as success. Match
 * on the CODE: a generic `ConflictError` is a real conflict, so `'rejected'`.
 */
export type ReplayOutcome =
  | { status: 'applied' | 'converged' }
  | { status: 'rejected'; typename: MutationErrorTypename };

export function classifyReplayResult(payload: unknown): ReplayOutcome {
  if (!payload || typeof payload !== 'object') return { status: 'applied' };

  const { __typename: typename, code } = payload as {
    __typename?: string;
    code?: string;
  };
  if (!typename || !isErrorTypename(typename)) return { status: 'applied' };

  if (typename === 'ConflictError' && code === ErrorCode.IdempotentReplay) {
    return { status: 'converged' };
  }
  return { status: 'rejected', typename };
}

/**
 * The API sets codes per-error inside `errors[i]`, while
 * `CombinedGraphQLErrors.extensions` is the RESPONSE-level bag — a flat
 * `extensions.code` read sees `undefined` for every real refusal. A flat `code`
 * comes from the session path's own errors (`SessionError`, refresh refusals).
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

/** Apollo 4 throws `ServerError` for a non-2xx response, carrying `statusCode`. */
function readStatusCode(error: unknown): number | undefined {
  return ServerError.is(error) ? error.statusCode : undefined;
}

/**
 * The logical resource name the API uses for a unit row in `NotFoundError`.
 * Compared case-insensitively: `resource` is documented as a logical type name
 * ("e.g. `MealPlan`"), not an enum, so its casing is not part of a contract.
 */
const UNIT_RESOURCE = 'unit';

/**
 * Codes the API documents as shedding load or pacing the caller. Each clears on
 * its own, so the entry is deferred rather than withdrawn — reverting a write
 * over one of these discards work the server never refused.
 */
const TRANSIENT_SERVER_CODES: readonly string[] = [
  TopLevelErrorCode.ServiceUnavailable,
];

/** Budget refusals: re-sending inside the window is refused again, so none is. */
const RATE_LIMIT_CODES: readonly string[] = [
  TopLevelErrorCode.RateLimitExceeded,
  TopLevelErrorCode.OperationRateLimited,
];

/** The per-operation window. RATE_LIMIT_EXCEEDED names `resetAt`, not `retryAfter`. */
const RATE_LIMIT_FALLBACK_SECONDS = 60;

/**
 * A missing unit row is the only unit refusal a vocabulary refresh can clear;
 * `UNIT_INVALID` is absent on purpose, since a retry re-sends the same unit.
 */
function isStaleUnitRefusal(error: ReplayRejectedError): boolean {
  return (
    error.payloadTypename === 'NotFoundError' &&
    error.payloadResource?.toLowerCase() === UNIT_RESOURCE
  );
}

/**
 * Pure classification of a replay error: `auth` retries after a token refresh,
 * `stale-reference` after a vocabulary refresh, `network`/`server` defer to the
 * next drain, `unknown` fails permanently. Separate from {@link QueueManager}'s
 * stateful retry orchestration so the heuristics are testable in isolation.
 */
export function classifyError(error: unknown): QueueError {
  // `retryable: false` skips the in-run loop (every attempt reads the same
  // missing value); QueueManager defers `server` regardless of the flag.
  if (error instanceof ReplayNotPreparedError) {
    return {
      type: 'server',
      message: error.message,
      code: REPLAY_NOT_PREPARED_CODE,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  if (error instanceof BatchRowDeferredError) {
    return {
      type: 'server',
      message: error.message,
      code: BATCH_ROW_TRANSIENT_CODE,
      timestamp: Date.now(),
      retryable: false,
    };
  }

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
    // The entity moved on since the write was made. Re-sendable, but only
    // without the stale `version` the write captured — QueueManager strips it
    // and re-sends once.
    if (
      error.payloadCode !== null &&
      VERSION_CONFLICT_CODES.includes(error.payloadCode)
    ) {
      return {
        type: 'conflict',
        message: error.message,
        code: error.payloadCode,
        timestamp: Date.now(),
        retryable: true,
      };
    }

    // The write names a unit the vocabulary repair merged away. The write is
    // fine — its reference went stale — so it is re-sent, not reverted.
    if (isStaleUnitRefusal(error)) {
      return {
        type: 'stale-reference',
        message: error.message,
        code: error.payloadCode ?? error.payloadTypename,
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

  const thrownMessage =
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : undefined;
  const message = firstNonBlank(thrownMessage) ?? String(error);
  const code = readErrorCode(error);

  // The thrown spelling of the same condition as the union member above.
  if (code && VERSION_CONFLICT_CODES.includes(code)) {
    return {
      type: 'conflict',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  // `retryable: false` skips the in-run loop; QueueManager defers `server` and
  // holds every drain until `retryAfterMs` has passed.
  if (code && RATE_LIMIT_CODES.includes(code)) {
    const retryAfter = getRateLimitDetails(error)?.retryAfter ?? 0;
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
      retryAfterMs:
        (retryAfter > 0 ? retryAfter : RATE_LIMIT_FALLBACK_SECONDS) * 1000,
    };
  }

  if (code && TRANSIENT_SERVER_CODES.includes(code)) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

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

  // A fetch failure, a socket close, or a deadline: the request never got an
  // answer, so nothing about the write was judged.
  if (isNetworkError(error)) {
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
