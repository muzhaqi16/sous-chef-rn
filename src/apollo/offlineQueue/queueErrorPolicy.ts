import type { QueueError } from './types';

/**
 * A replayed mutation resolved, but the payload was an error union member —
 * the server refused the change. Thrown by the queue's replay path so the
 * refusal routes through the permanent-failure pipeline (revert + toast +
 * dequeue) instead of being mistaken for success. Carries the payload's
 * `__typename` so {@link classifyError} can classify it deterministically
 * without running the free-text server message through the string heuristics
 * below (a message like "subscription expired" must not be re-classified as
 * an auth error and retried forever).
 */
export class ReplayRejectedError extends Error {
  readonly payloadTypename: string;

  constructor(payloadTypename: string, message: string) {
    super(message);
    this.name = 'ReplayRejectedError';
    this.payloadTypename = payloadTypename;
  }
}

/**
 * Outcome of a replayed mutation that RESOLVED with data (no thrown error).
 *
 * Under the global `errorPolicy: 'all'` a server refusal (`ValidationError`,
 * `ConflictError`, `ForbiddenError`, `NotFoundError` union members) resolves
 * instead of throwing — the same trap `classifyCreateResult` closes on the
 * foreground path. This is the replay-side counterpart; the two must agree
 * that a resolved error payload is a refusal, never a success.
 *
 * Takes the already-extracted payload (the mutation's single top-level field
 * value).
 *
 *  - `'applied'`   — success payload (or a scalar/absent field that carries no
 *                    error signal). Dequeue. This is also where a converged
 *                    SUCCESS payload lands (`converged: true` on favorites,
 *                    cooking logs, and the `sync*` resource ops) — it doesn't end
 *                    in `Error`, so it's treated as applied.
 *  - `'converged'` — `ConflictError` whose `code` is `IDEMPOTENT_REPLAY`: the
 *                    API-wide signal that this exact op already committed once.
 *                    Covers both idempotency-keyed cumulative ops (restock /
 *                    consume / waste / adjust / open-batch / convert-expired,
 *                    keyed by `input.idempotencyKey`) and client-PK creates
 *                    (keyed by the row id). The change is on the server; dequeue
 *                    as success. Match on the CODE, never the message, and never
 *                    a generic `ConflictError` (that's a real version/uniqueness
 *                    conflict → rejected).
 *  - `'rejected'`  — any other error payload: the server refused the change.
 *                    Route to the permanent-failure pipeline.
 */
export type ReplayOutcome = 'applied' | 'converged' | 'rejected';

export function classifyReplayResult(payload: unknown): ReplayOutcome {
  if (!payload || typeof payload !== 'object') return 'applied';

  const { __typename: typename, code } = payload as {
    __typename?: string;
    code?: string;
  };
  if (!typename || !typename.endsWith('Error')) return 'applied';

  if (typename === 'ConflictError' && code === 'IDEMPOTENT_REPLAY') {
    return 'converged';
  }
  return 'rejected';
}

/**
 * Classify a replay error into the queue's policy categories. Pure — the result
 * drives whether the queue retries (`auth` after token refresh; `network` /
 * `server` deferred for the next drain) or fails permanently (`unknown`: client /
 * 4xx / GraphQL validation). Kept separate from the stateful retry orchestration
 * in {@link QueueManager} so the heuristics are testable in isolation.
 */
export function classifyError(error: unknown): QueueError {
  // A rejected replay payload is classified by its typename, not its message —
  // the message is server-authored free text and must not hit the string
  // heuristics below.
  if (error instanceof ReplayRejectedError) {
    return {
      type: 'unknown',
      message: error.message,
      code: error.payloadTypename,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  const err = (error ?? {}) as {
    message?: string;
    code?: string;
    extensions?: { code?: string };
    networkError?: { statusCode?: number };
  };
  const message = err.message || String(error);
  const code = err.extensions?.code || err.code;

  // Resource-access errors. FORBIDDEN / AUTHZ_FORBIDDEN mean the user doesn't
  // have access to the resource — not an auth issue, so a token refresh won't
  // help. Match errorLink's policy: treat them as permanent failures rather
  // than retrying behind a refresh. AUTHZ_FORBIDDEN is the API's current code;
  // FORBIDDEN is the legacy alias still emitted by some resolvers.
  if (code === 'FORBIDDEN' || code === 'AUTHZ_FORBIDDEN') {
    return {
      type: 'unknown',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // Auth errors
  if (
    code === 'UNAUTHENTICATED' ||
    code === 'AUTH_TOKEN_EXPIRED' ||
    message.toLowerCase().includes('expired') ||
    message.toLowerCase().includes('unauthorized')
  ) {
    return {
      type: 'auth',
      message,
      code,
      timestamp: Date.now(),
      retryable: true, // Can retry after token refresh
    };
  }

  // Network errors. Match "timed out" too — the processing-timeout rejects with
  // 'Operation timed out', which doesn't contain the substring "timeout".
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

  // Server errors (5xx)
  if ((err.networkError?.statusCode ?? 0) >= 500) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: true,
    };
  }

  // Unknown/client errors (4xx, GraphQL errors)
  return {
    type: 'unknown',
    message,
    code,
    timestamp: Date.now(),
    retryable: false, // Don't retry client errors
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
  const jitter = Math.random() * 500; // Add jitter to prevent thundering herd
  return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
}
