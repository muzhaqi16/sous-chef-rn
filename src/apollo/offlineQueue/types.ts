import { DocumentNode } from 'graphql';
import type { WriteIntent } from '#/apollo/write/writeIntent';
import type { DefaultContext, OperationVariables } from '@apollo/client';

/**
 * Status of a queued mutation
 */
export enum QueueStatus {
  PENDING = 'pending', // Waiting to be processed
  PROCESSING = 'processing', // Currently being sent to server
  FAILED = 'failed', // Failed after retries (network/server error)
  AUTH_ERROR = 'auth_error', // Failed due to authentication issues
  SUCCESS = 'success', // Successfully processed (kept briefly for reconciliation)
}

/**
 * Thrown by `queueStore.addMutation` when the queue is at capacity and holds no
 * terminal (SUCCESS/FAILED) entry to evict — i.e. it is full of un-synced work.
 * Rejecting the enqueue is deliberate: silently dropping the oldest PENDING op
 * would break create→update dependency chains. Callers can surface this as a
 * "too many unsynced changes" message.
 */
export class QueueCapacityError extends Error {
  constructor(
    message = 'Too many unsynced changes. Reconnect to sync before making more changes.',
  ) {
    super(message);
    this.name = 'QueueCapacityError';
  }
}

/**
 * Error information for failed mutations
 */
export interface QueueError {
  /**
   * `conflict` is its own category, not a shade of the other two. The server
   * declined because the entity moved on since the write was made — a
   * statement about the version the write CARRIED, not about the write's
   * merits. Retrying re-sends the same stale version and cannot succeed;
   * withdrawing discards work the server never judged. It needs the version
   * refreshed first (absolute writes) or the person told (relative ones).
   */
  type: 'network' | 'auth' | 'server' | 'unknown' | 'conflict';
  message: string;
  code?: string;
  timestamp: number;
  retryable: boolean;
}

/**
 * How a queued write's value relates to the value already on the server —
 * the one bit about a write that cannot be inferred from its input.
 *
 * `absolute`: the input carries a final value (a recount, a corrected weight,
 * a set-to-state). Re-sending it against a refreshed version applies the user's
 * number, which is what they meant; last-writer-wins is the intended semantic.
 *
 * `relative`: the input carries a change to whatever is there (a delta, a
 * cumulative ledger op). Re-sending it against a refreshed version applies it a
 * SECOND time — the double-apply `idempotencyKey` exists to prevent. These
 * report the overwrite instead.
 *
 * Not inferable: `newQuantity` and a delta are both numbers on inputs that
 * otherwise look alike, and guessing wrong is a silent double-apply. Defaults
 * to `relative`, the safe direction — a write that never declares is reported
 * rather than re-sent.
 */
export type WriteConvergence = 'absolute' | 'relative';

/**
 * A queued mutation waiting to be processed
 */
export interface QueuedMutation {
  // Identification
  id: string; // UUID for tracking
  userId: string; // User who created the mutation (critical for auth)
  operationName: string; // GraphQL operation name for debugging

  // Mutation details
  mutation: DocumentNode; // GraphQL mutation document
  variables: OperationVariables; // Mutation variables
  context?: DefaultContext; // Allowlisted replay context (localFirst, convergence)
  /**
   * How this write's value relates to the server's. Read on a version
   * conflict to choose between refreshing the version and re-sending, and
   * telling the person their change was overwritten. Absent on entries
   * persisted before this existed, which read as `relative`.
   */
  convergence?: WriteConvergence;
  /**
   * The local change this mutation stands for, including what undoes it.
   *
   * Carried here because the queue entry is the only durable record of a
   * pending change: a withdrawal can happen after a restart — an expiry, a
   * permanent refusal on the next drain — and by then nothing else remembers
   * what the entity looked like beforehand. Plain JSON by construction, since
   * it round-trips through MMKV with the rest of the entry.
   *
   * Optional: an entry written before intents existed, or a mutation whose
   * hook has not been converted yet, simply has none and falls back to the
   * older withdrawal behaviour.
   *
   * A LIST because one mutation can change several entities: a batch move
   * takes N rows out of a list in one call, and a single-entity intent cannot
   * say that. Forcing one through anyway is what produced the `after: {}`
   * defect — see the kit's `Lifecycle` docblock. Undone in reverse order, so
   * the last change made is the first put back.
   */
  intents?: WriteIntent[];

  /**
   * @deprecated Superseded by {@link QueuedMutation.intents}. Still READ, never
   * written: an entry persisted before the list existed is replayed by a build
   * that expects one, and the queue horizon is ninety days.
   */
  intent?: WriteIntent;

  // Status tracking
  status: QueueStatus;
  createdAt: number; // Timestamp when added to queue
  updatedAt: number; // Last status update timestamp
  processedAt?: number; // When successfully processed

  // Retry logic
  retryCount: number; // Number of retry attempts
  maxRetries: number; // Maximum retries before marking as failed
  lastError?: QueueError; // Last error encountered
  /**
   * Version conflicts survived. Bounds the refresh-and-re-send loop so a row
   * under constant concurrent edit withdraws rather than deferring forever.
   * Optional: entries persisted by an older build lack it, so every read
   * defaults to 0.
   */
  conflictCount?: number;
  /**
   * Transient deferrals survived. Bounds head-of-line blocking. Optional for
   * the same reason as {@link conflictCount}.
   */
  deferCount?: number;

  // Auth
  requiresAuth: boolean; // Whether mutation requires authentication
}

/**
 * Statistics about the mutation queue
 */
export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  failed: number;
  authErrors: number;
  oldestMutationAge?: number; // Age of oldest pending mutation in ms
}

/**
 * Configuration for the queue manager. (Queue size is bounded in queueStore;
 * per-mutation max retries ride on each QueuedMutation.)
 */
export interface QueueConfig {
  retryDelayMs: number; // Delay between retries (with exponential backoff)
  processingTimeoutMs: number; // Timeout for individual mutation processing
}

/**
 * Result of processing a queued mutation
 */
export interface ProcessingResult {
  success: boolean;
  mutationId: string;
  error?: QueueError;
  serverResponse?: Record<string, unknown>;
  // Set when a transient (network/server) error returned the mutation to
  // PENDING. Signals the drain loop to stop rather than replay later
  // mutations ahead of this un-synced one.
  deferred?: boolean;
}

/**
 * Information about a permanently failed mutation, passed to the failure handler
 */
export interface FailedMutationInfo {
  mutationId: string;
  operationName: string;
  entityType: string | null;
  entityId: string | null;
  error: QueueError;
  /** The changes to undo, when the mutation carried any. Reverted in reverse. */
  intents?: WriteIntent[];
}

/**
 * Callback invoked when a mutation permanently fails after exhausting retries
 */
export type FailureHandler = (info: FailedMutationInfo) => void;
