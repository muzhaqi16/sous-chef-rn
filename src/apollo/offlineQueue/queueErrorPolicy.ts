import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
} from '@apollo/client/errors';
import { ErrorCode, TopLevelErrorCode } from '#/graphql/generated/schemaTypes';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';
import { isNetworkError } from '#/utils/isNetworkError';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { isVersionConflictCode } from '#/utils/errors/versionConflict';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import { refusalEnvelopeOf } from '#/utils/errors/graphqlErrors';
import {
  isErrorTypename,
  type MutationErrorTypename,
} from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import { backoffDelay } from '#/utils/backoff';
import type { QueueError } from './types';

/**
 * A replay refused with an error union member. Carries its `__typename` and
 * `code` so {@link classifyError} never reads the message: "subscription
 * expired" through the string heuristics below is an auth error retried forever.
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
    const failure: unknown = isRecord(result) ? result.failure : undefined;
    if (
      isRecord(result) &&
      result.success === false &&
      isRecord(failure) &&
      typeof failure.code === 'string' &&
      TRANSIENT_ROW_CODES.includes(failure.code)
    ) {
      return failure.code;
    }
  }
  return null;
}

/**
 * A replay that RESOLVED, as a refusal does under `errorPolicy: 'all'`.
 * `'converged'` is a `ConflictError` coded `IDEMPOTENT_REPLAY`, already
 * committed; any other `ConflictError` is a real conflict, `'rejected'`.
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
 * The API codes each `errors[i]`; `CombinedGraphQLErrors.extensions` is the
 * RESPONSE-level bag, `undefined` for every real refusal. A flat `code` comes
 * from the session path's own errors (`SessionError`, refresh refusals).
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

  // A refusal before execution: the code is in the body of a non-2xx response.
  const envelope = refusalEnvelopeOf(error);
  if (envelope) return envelope.code;

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

/** The wait when a rate-limit refusal states none. */
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
 * `auth` retries after a token refresh, `stale-reference` after a vocabulary
 * refresh, `network`/`server` defer to the next drain, `unknown` fails
 * permanently.
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
    // The entity moved on since the write was made, so nothing applied.
    // QueueManager withdraws and reports it rather than re-sending.
    if (
      error.payloadCode !== null &&
      isVersionConflictCode(error.payloadCode)
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
  if (isVersionConflictCode(code)) {
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

  // Deferred, not failed, so the change survives on disk and syncs once the
  // user updates; `retryable: false` skips the in-run loop, as every attempt
  // sends the same version.
  if (code === TopLevelErrorCode.ClientUpgradeRequired) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // No refresh fixes either, so both fail permanently, as in errorLink.
  // AUTH_ACCOUNT_SUSPENDED returns HERE: wording containing "unauthorized"
  // would otherwise spin the queue retrying a dead account.
  if (code === ErrorCode.Forbidden || code === ErrorCode.AuthAccountSuspended) {
    return {
      type: 'unknown',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // The auth family by CODE only: message matching on 'expired'/'unauthorized'
  // pulls in refusals unrelated to the token. A code no refresh fixes is
  // self-limiting: an empty proactiveTokenRefresh() fails the entry.
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
 * `baseDelayMs` (the queue's configured retry delay) doubling per retry, capped
 * at 30s, then up to half again at random so devices don't retry in step.
 */
export function calculateRetryDelay(
  retryCount: number,
  baseDelayMs: number,
): number {
  return backoffDelay(retryCount, {
    baseMs: baseDelayMs,
    maxMs: 30_000,
    jitter: 0.5,
  });
}
