import {
  CombinedGraphQLErrors,
  CombinedProtocolErrors,
  ServerError,
} from '@apollo/client/errors';
import {
  ErrorCode,
  ErrorDisposition,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { isAuthRefusalCode } from '#/utils/authErrorCodes';
import { isNetworkError } from '#/utils/isNetworkError';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { isVersionConflictCode } from '#/utils/errors/versionConflict';
import { getRateLimitDetails } from '#/utils/errors/rateLimit';
import { asDisposition, refusalEnvelopeOf } from '#/utils/errors/graphqlErrors';
import {
  isErrorTypename,
  type MutationErrorTypename,
} from '#/utils/errors/mutationPayload';
import { isRecord } from '#/utils/isRecord';
import { backoffDelay } from '#/utils/backoff';
import type { QueueError } from './types';

/**
 * A replay refused with an error union member. Carries its `__typename`, `code`
 * and `disposition` so {@link classifyError} never reads the message:
 * "subscription expired" read as text is an auth error retried forever.
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
  readonly payloadDisposition: ErrorDisposition | undefined;

  constructor(
    payloadTypename: MutationErrorTypename,
    message: string,
    payloadCode?: string | null,
    payloadResource?: string | null,
    payloadDisposition?: unknown,
  ) {
    super(message);
    this.name = 'ReplayRejectedError';
    this.payloadTypename = payloadTypename;
    this.payloadCode = payloadCode ?? null;
    this.payloadResource = payloadResource ?? null;
    this.payloadDisposition = asDisposition(payloadDisposition);
  }
}

const INTERNAL_FAULT_CODE: string = TopLevelErrorCode.InternalServerError;
const UPGRADE_CODE: string = TopLevelErrorCode.ClientUpgradeRequired;

/** The server cannot validate this build's document, which a deploy or an update cures. */
const SCHEMA_INVALID_CODE = 'GRAPHQL_VALIDATION_FAILED';

const REPLAY_NOT_PREPARED_CODE = 'REPLAY_NOT_PREPARED';

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

const BATCH_ROW_TRANSIENT_CODE = 'BATCH_ROW_TRANSIENT';

/**
 * A batch applied but a row inside `results` can succeed later. The API
 * converges each row on its id, so re-sending the whole entry later is safe;
 * reverting that row would discard a write the server never refused.
 */
export class BatchRowDeferredError extends Error {
  constructor(operationName: string, rowCode: string) {
    super(`${operationName} has a row that failed transiently (${rowCode})`);
    this.name = 'BatchRowDeferredError';
  }
}

/**
 * A batch applied but the server refused a row. Thrown once the rows that
 * landed are settled; the entry is kept whole, as a retry converges on them.
 */
export class BatchRowRefusedError extends Error {
  readonly rowCode: string;

  constructor(operationName: string, rowCode: string) {
    super(`${operationName} has a row the server refused (${rowCode})`);
    this.name = 'BatchRowRefusedError';
    this.rowCode = rowCode;
  }
}

interface FailedRow {
  code: string;
  disposition: ErrorDisposition | undefined;
}

function failedRowsOf(payload: unknown): FailedRow[] {
  const results: unknown = isRecord(payload) ? payload.results : undefined;
  if (!Array.isArray(results)) return [];
  return (results as unknown[]).flatMap(result => {
    if (!isRecord(result) || result.success !== false) return [];
    const failure = isRecord(result.failure) ? result.failure : {};
    return [
      {
        code: typeof failure.code === 'string' ? failure.code : '',
        disposition: asDisposition(failure.disposition),
      },
    ];
  });
}

/** The code of the first row of a batch answer that can succeed if sent again. */
export function transientBatchRowCode(payload: unknown): string | null {
  const row = failedRowsOf(payload).find(
    ({ disposition }) => disposition === ErrorDisposition.Retry,
  );
  return row?.code ?? null;
}

/** The code of the first row of a batch answer that neither landed nor can retry. */
export function refusedBatchRowCode(payload: unknown): string | null {
  const row = failedRowsOf(payload).find(
    ({ disposition }) =>
      disposition !== ErrorDisposition.Retry &&
      disposition !== ErrorDisposition.Applied,
  );
  return row?.code ?? null;
}

/** A replay answered: `'converged'` landed on an earlier send, with no row to show. */
export type ReplayOutcome =
  | { status: 'applied' | 'converged' }
  | { status: 'rejected'; typename: MutationErrorTypename };

/** `error` is a top-level refusal, which states `APPLIED` as a payload does. */
export function classifyReplayResult(
  payload: unknown,
  error?: unknown,
): ReplayOutcome {
  if (readVerdict(error).disposition === ErrorDisposition.Applied) {
    return { status: 'converged' };
  }
  if (!payload || typeof payload !== 'object') return { status: 'applied' };

  const { __typename: typename, disposition } = payload as {
    __typename?: string;
    disposition?: unknown;
  };
  if (!typename || !isErrorTypename(typename)) return { status: 'applied' };

  return asDisposition(disposition) === ErrorDisposition.Applied
    ? { status: 'converged' }
    : { status: 'rejected', typename };
}

interface Verdict {
  code?: string;
  disposition?: ErrorDisposition;
}

/**
 * The API states each `errors[i]`; `CombinedGraphQLErrors.extensions` is the
 * RESPONSE-level bag, `undefined` for every real refusal. A flat `code` comes
 * from the session path's own errors (`SessionError`, refresh refusals).
 */
function readVerdict(error: unknown): Verdict {
  if (CombinedGraphQLErrors.is(error) || CombinedProtocolErrors.is(error)) {
    // First code wins: the queue needs one classification, and the branches
    // below are ordered so the most consequential refusal is acted on anyway.
    for (const graphQLError of error.errors) {
      const { code, disposition } = graphQLError.extensions ?? {};
      if (typeof code === 'string') {
        return { code, disposition: asDisposition(disposition) };
      }
    }
    return {};
  }

  // A refusal before execution: the code is in the body of a non-2xx response.
  const envelope = refusalEnvelopeOf(error);
  if (envelope) return envelope;

  const flat = error as
    | {
        code?: string;
        disposition?: unknown;
        extensions?: { code?: string; disposition?: unknown };
      }
    | null
    | undefined;
  return {
    code: flat?.extensions?.code ?? flat?.code,
    disposition: asDisposition(
      flat?.extensions?.disposition ?? flat?.disposition,
    ),
  };
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
 * What the server's `disposition` leaves to do, so a code newer than this build
 * still settles: `RETRY` defers, `RESOLVE` waits for what clears it and `FAIL`
 * refuses. The codes read here are the ones with a recovery of their own.
 * `auth` retries after a token refresh, `stale-reference` after a vocabulary
 * refresh, `network`/`server` defer to the next drain, `unknown` goes to the
 * refused list.
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
      entryScoped: true,
    };
  }

  if (error instanceof BatchRowDeferredError) {
    return {
      type: 'server',
      message: error.message,
      code: BATCH_ROW_TRANSIENT_CODE,
      timestamp: Date.now(),
      retryable: false,
      entryScoped: true,
    };
  }

  if (error instanceof BatchRowRefusedError) {
    return {
      type: 'unknown',
      message: error.message,
      code: error.rowCode,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // Classified by typename/code, never by the server-authored free-text message.
  if (error instanceof ReplayRejectedError) {
    // A union member answers for this row, so the rest of the pass still runs.
    if (error.payloadDisposition === ErrorDisposition.Retry) {
      return {
        type: 'server',
        message: error.message,
        code: error.payloadCode ?? error.payloadTypename,
        timestamp: Date.now(),
        retryable: true,
        entryScoped: true,
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
  const { code, disposition } = readVerdict(error);

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

  if (disposition === ErrorDisposition.Retry) {
    // `retryable: false` skips the in-run loop, as a re-send inside the window
    // is refused again; QueueManager holds every drain until `retryAfterMs`.
    const pacing = getRateLimitDetails(error);
    if (pacing) {
      const seconds = pacing.retryAfter ?? 0;
      return {
        type: 'server',
        message,
        code,
        timestamp: Date.now(),
        retryable: false,
        retryAfterMs:
          (seconds > 0 ? seconds : RATE_LIMIT_FALLBACK_SECONDS) * 1000,
      };
    }
    // A resolver crash answers 200 with this code, and masking hides a crash on
    // this one input from an outage, so `fault` bounds it (`handleMutationError`).
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
      fault: code === INTERNAL_FAULT_CODE,
    };
  }

  // A dead account: no refresh fixes it, as in errorLink, so it is refused
  // ahead of the auth family, where it would spend one on every write.
  if (code === ErrorCode.AuthAccountSuspended) {
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

  // Deferred, not refused, so the change survives on disk and sends once what
  // refused it clears; `retryable: false` skips the in-run loop, as every
  // attempt sends the same thing. An upgrade refuses every write alike, and a
  // document only this build's update cures waits for it. Anything else is
  // counted, as a stored write can meet what nothing here will clear.
  if (disposition === ErrorDisposition.Resolve) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
      entryScoped: code !== UPGRADE_CODE,
      fault: code !== UPGRADE_CODE && code !== SCHEMA_INVALID_CODE,
    };
  }

  if (disposition === ErrorDisposition.Fail) {
    return {
      type: 'unknown',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
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

  const status = readStatusCode(error) ?? 0;
  if (status >= 500) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
      fault: status === 500,
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
