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
  /**
   * The error member's `code`, when the payload carried one. Lets
   * {@link classifyError} branch on documented transient codes (`DEADLOCK`)
   * without string-matching the free-text message.
   */
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
  if (!typename || !isErrorTypename(typename)) return 'applied';

  if (typename === 'ConflictError' && code === ErrorCode.IdempotentReplay) {
    return 'converged';
  }
  return 'rejected';
}

/**
 * Pull the error code out of whatever Apollo threw.
 *
 * The queue replays through `client.mutate`, which rejects with Apollo's own
 * error classes — and those keep the code somewhere a flat `error.extensions.code`
 * read never looked. `CombinedGraphQLErrors.extensions` is the RESPONSE-level
 * extensions bag, while the API sets its codes per-error, inside `errors[i]`.
 * Reading the flat shape alone therefore saw `undefined` for every real server
 * refusal, so each code branch below was dead against production traffic and
 * every refusal fell through to the message heuristics or the permanent bucket.
 * The synthetic `{ code }` objects in the tests matched, which is why it looked
 * fine.
 *
 * The flat shapes are still read, last: `queueStore` persists `lastError` and
 * replays it back through here, and callers construct that shape directly.
 */
function readErrorCode(error: unknown): string | undefined {
  if (CombinedGraphQLErrors.is(error) || CombinedProtocolErrors.is(error)) {
    // First code wins. A partial-success response can carry several errors;
    // the queue only needs one classification, and the branches below are
    // ordered so the most consequential refusal is acted on either way.
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
 * HTTP status behind a non-200 response.
 *
 * Apollo 4 throws `ServerError` carrying `statusCode` directly; the
 * `networkError.statusCode` nesting read here before is the Apollo 3
 * `ApolloError` shape, which nothing produces any more. That made the 5xx
 * branch dead too — a transient server error was reverted and dequeued as a
 * permanent client fault, losing the user's queued write over an outage that
 * would have cleared on its own.
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
 * Classify a replay error into the queue's policy categories. Pure — the result
 * drives whether the queue retries (`auth` after token refresh; `network` /
 * `server` deferred for the next drain) or fails permanently (`unknown`: client /
 * 4xx / GraphQL validation). Kept separate from the stateful retry orchestration
 * in {@link QueueManager} so the heuristics are testable in isolation.
 */
export function classifyError(error: unknown): QueueError {
  // A rejected replay payload is classified by its typename/code, not its
  // message — the message is server-authored free text and must not hit the
  // string heuristics below.
  if (error instanceof ReplayRejectedError) {
    // DEADLOCK is the one ConflictError code the API documents as a transient
    // lock conflict ("safe to retry"): defer like a server error so the entry
    // stays queued for the next drain instead of being reverted + dequeued.
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

  // The build is below the server's minimum version, so every replay of this
  // entry is refused until the user updates from the store. Deferred rather
  // than failed: the change stays on disk and syncs after the update, where
  // reverting would throw away work over a condition the user can actually fix.
  // `retryable: false` skips the in-run retry loop — each attempt would send
  // the same version and be refused identically — while QueueManager defers
  // `server` regardless of that flag, which is the combination wanted here.
  if (code === TopLevelErrorCode.ClientUpgradeRequired) {
    return {
      type: 'server',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // Resource-access errors. FORBIDDEN means the user doesn't have access to the
  // resource — not an auth issue, so a token refresh won't help. Match
  // errorLink's policy: treat it as a permanent failure rather than retrying
  // behind a refresh. It is the single authorization code on both channels (the
  // mutation result-union member's `code` and the top-level `extensions.code`).
  // AUTH_ACCOUNT_SUSPENDED joins it: the account is suspended, banned, or
  // deleted, so no replay of this entry can ever succeed and a token refresh
  // cannot revive it. Classified here rather than left to the default so the
  // message heuristics in the auth branch below can never see it — server
  // wording that happened to contain "unauthorized" would otherwise mark a
  // permanently dead account retryable and spin the queue against it.
  if (code === ErrorCode.Forbidden || code === ErrorCode.AuthAccountSuspended) {
    return {
      type: 'unknown',
      message,
      code,
      timestamp: Date.now(),
      retryable: false,
    };
  }

  // Auth errors. Matching the whole family rather than AUTH_TOKEN_EXPIRED alone:
  // AUTH_TOKEN_MISSING is exactly what a refresh fixes, yet on its own it used to
  // fall past this branch into the permanent bucket below and get reverted +
  // dequeued without a single retry.
  //
  // The codes a refresh genuinely cannot fix (a rejected refresh token) are
  // self-limiting here: QueueManager runs proactiveTokenRefresh() once for an
  // `auth` classification and marks the entry failed when it comes back without
  // a token, so a dead session costs one attempt, not a retry loop. That is why
  // this asks the coarse question instead of splitting the family.
  // AUTH_ACCOUNT_SUSPENDED is in the set too, but the resource-access branch
  // above returns first and must keep doing so — a suspended account is
  // permanent, so it should not spend a refresh attempt per queued entry.
  //
  // Classified by code only. Matching 'expired' / 'unauthorized' in the message
  // used to pull in refusals that have nothing to do with the token — an API key
  // rejected for want of a permission reads "Unauthorized: …" — and each one
  // then cost the queue a doomed refresh before failing anyway.
  if (isAuthRefusalCode(code ?? '')) {
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
  if ((readStatusCode(error) ?? 0) >= 500) {
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
