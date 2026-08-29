import type { DocumentNode } from 'graphql';
import { storage } from '#storage/mmkv';
import {
  QueueCapacityError,
  QueuedMutation,
  QueueError,
  QueueStats,
  QueueStatus,
} from './types';
import { logger } from '#/utils/environment';
import { queuedEntityIds } from './queuedEntityIds';

const QUEUE_STORAGE_KEY = 'apollo-mutation-queue';
const CURRENT_USER_KEY = 'apollo-queue-current-user';

// Hard cap on total queued mutations across all users. When reached, terminal
// (SUCCESS/FAILED) entries are evicted first; a queue full of un-synced work
// rejects the enqueue rather than dropping a PENDING op mid dependency chain.
const MAX_QUEUE_SIZE = 100;

/**
 * Terminal = the queue will not replay it as things stand. SUCCESS replayed;
 * FAILED was refused and its local change already withdrawn.
 *
 * AUTH_ERROR is terminal in the same bookkeeping sense but NOT in meaning: the
 * server never saw the write, so nothing about it was rejected — we just could
 * not authenticate. It is revived by {@link QueueStore.revivePendingAuthErrors}
 * on the next sign-in and its local change stands until it is actually
 * discarded. It counts as terminal here so it stays evictable at capacity:
 * before that, 100 accumulated auth failures wedged the queue permanently, and
 * every later enqueue threw QueueCapacityError with no way back.
 */
function isTerminal(status: QueueStatus): boolean {
  return (
    status === QueueStatus.SUCCESS ||
    status === QueueStatus.FAILED ||
    status === QueueStatus.AUTH_ERROR
  );
}

/**
 * How long a queued write may wait before the app gives up on it.
 *
 * Bounded by the server's idempotency-dedup retention: past that horizon the
 * dedup record that would classify a replay as IDEMPOTENT_REPLAY is gone, so
 * replaying would apply the write a SECOND time.
 *
 * The number is the server's to decide, and it now publishes it as
 * `Query.offlineWritePolicy.replayHorizonDays`. Restating it here as a literal
 * meant two constants that had to agree with nothing checking them — and a
 * disagreement does not fail loudly, it double-applies a write. So this is a
 * fallback for the launches that have not read the policy yet, and
 * {@link QueueStore.setReplayHorizonDays} carries the server's answer once
 * one has.
 */
const FALLBACK_HORIZON_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * On-disk shape of a queued mutation: identical to {@link QueuedMutation}
 * except the `mutation` DocumentNode is stored as a serialized JSON string.
 */
type SerializedQueuedMutation = Omit<QueuedMutation, 'mutation'> & {
  mutation: string;
};

/**
 * Persistent queue store using MMKV
 * Provides user-scoped mutation queuing with atomic operations
 */
export class QueueStore {
  // PERFORMANCE: In-memory cache to avoid repeated MMKV reads and JSON parsing
  // Write-through pattern: cache is updated on every write and invalidated on user change
  private cache: QueuedMutation[] | null = null;

  // In-memory mirror of CURRENT_USER_KEY (undefined = not yet read from
  // storage) and the memoized pending-ids set. getPendingClientIds() runs on
  // EVERY itemsConnection merge (cache.ts), so without these each connection
  // write costs a sync MMKV read plus a Set rebuild.
  private currentUserId: string | null | undefined = undefined;
  private pendingClientIds: Set<string> | null = null;

  /**
   * The server's replay horizon, once something has read it. Deliberately not
   * persisted: a stale horizon is worse than no horizon, and re-reading it is
   * one field on a query the app already makes.
   */
  private replayHorizonDays: number = FALLBACK_HORIZON_DAYS;

  // Subscribers notified on every queue change (add/remove/update/clear and
  // user switches). Lets UI read live queue state — e.g. the offline banner's
  // pending-changes count — via useSyncExternalStore without polling MMKV.
  private listeners = new Set<() => void>();

  /**
   * Adopt the server's published replay horizon.
   *
   * Ignores a non-positive value rather than trusting it: a zero would expire
   * every queued write on the next drain, which is the one failure mode worse
   * than the drift this exists to remove.
   */
  setReplayHorizonDays(days: number): void {
    if (!Number.isFinite(days) || days <= 0) return;
    this.replayHorizonDays = days;
  }

  /**
   * Subscribe to queue changes. Returns an unsubscribe function.
   * `useSyncExternalStore`-compatible.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        logger.error('Queue: change listener threw:', error);
      }
    });
  }

  /**
   * Load all mutations from storage
   * Uses in-memory cache with write-through pattern
   */
  private loadQueue(): QueuedMutation[] {
    try {
      // Return cached queue if available
      if (this.cache !== null) {
        return this.cache;
      }

      // Cache miss - load from storage
      const queueJson = storage.getString(QUEUE_STORAGE_KEY);
      if (!queueJson) {
        this.cache = [];
        return [];
      }

      const parsed = JSON.parse(queueJson) as SerializedQueuedMutation[];

      // Reconstruct DocumentNode from serialized string
      const queue: QueuedMutation[] = parsed.map(item => ({
        ...item,
        mutation: JSON.parse(item.mutation) as DocumentNode, // Restore the mutation DocumentNode
      }));

      // Populate cache for future reads
      this.cache = queue;

      return queue;
    } catch (error) {
      logger.error('Failed to load queue from storage:', error);
      return [];
    }
  }

  /**
   * Save queue to storage
   * Uses write-through caching: updates both cache and storage
   */
  private saveQueue(mutations: QueuedMutation[]): void {
    try {
      // Serialize DocumentNode to string for storage
      const serialized = mutations.map(m => ({
        ...m,
        mutation: JSON.stringify({
          kind: m.mutation.kind,
          definitions: m.mutation.definitions,
          loc: m.mutation.loc,
        }),
      }));

      storage.set(QUEUE_STORAGE_KEY, JSON.stringify(serialized));

      // Write-through: update cache immediately
      this.cache = mutations;
    } catch (error) {
      logger.error('Failed to save queue to storage:', error);
    }
    this.pendingClientIds = null;
    this.notifyListeners();
  }

  /**
   * Get the current user ID
   */
  getCurrentUserId(): string | null {
    if (this.currentUserId === undefined) {
      this.currentUserId = storage.getString(CURRENT_USER_KEY) || null;
    }
    return this.currentUserId;
  }

  /**
   * Set the current user ID
   */
  setCurrentUserId(userId: string): void {
    storage.set(CURRENT_USER_KEY, userId);
    this.currentUserId = userId;
    this.pendingClientIds = null;
    // The pending count is user-scoped, so a user switch changes it even
    // though the queue contents didn't.
    this.notifyListeners();
  }

  /**
   * Clear the current user ID
   */
  clearCurrentUserId(): void {
    storage.remove(CURRENT_USER_KEY);
    this.currentUserId = null;
    this.pendingClientIds = null;
    this.notifyListeners();
  }

  /**
   * Add a mutation to the queue
   * Implements mutation coalescing for MoveShoppingListItem operations:
   * - Multiple moves of the same item are merged into a single mutation
   * - Only the final position is kept, reducing server load
   */
  addMutation(mutation: QueuedMutation): QueuedMutation | null {
    const queue = this.loadQueue();

    // OPTIMIZATION: Coalesce move mutations for the same item
    if (mutation.operationName === 'MoveShoppingListItem') {
      const itemId = mutation.variables?.input?.itemId;

      if (itemId) {
        // Find existing move mutation for same item
        const existingIndex = queue.findIndex(
          m =>
            m.operationName === 'MoveShoppingListItem' &&
            m.variables?.input?.itemId === itemId &&
            m.userId === mutation.userId &&
            m.status === QueueStatus.PENDING, // Only coalesce pending mutations
        );

        if (existingIndex !== -1) {
          // Replace existing mutation with new one (final position)
          logger.debug(
            `🔄 Queue: Coalescing move mutations for item ${itemId} - keeping final position`,
          );
          queue[existingIndex] = mutation;
          this.saveQueue(queue);
          return null;
        }
      }
    }

    // Regular add logic for non-move mutations or first move.
    // Enforce the queue cap without ever silently dropping a PENDING op:
    // evict the oldest terminal (SUCCESS/FAILED) entry to make room — those are
    // done and safe to drop. Dropping a PENDING op instead would break a
    // create→update dependency chain (the update replays against a create that
    // never happened). If nothing terminal exists, the queue is full of
    // un-synced work: reject the enqueue honestly.
    if (queue.length >= MAX_QUEUE_SIZE) {
      // Prefer an entry whose local change is already reconciled — SUCCESS
      // replayed, FAILED was withdrawn. An AUTH_ERROR still has its change on
      // screen awaiting a sign-in, so it is evicted only when it is the only
      // thing left to take.
      const reconciled = (m: QueuedMutation): boolean =>
        m.status === QueueStatus.SUCCESS || m.status === QueueStatus.FAILED;
      const preferred = queue.findIndex(reconciled);
      const evictIndex =
        preferred !== -1
          ? preferred
          : queue.findIndex(m => isTerminal(m.status));
      if (evictIndex === -1) {
        logger.warn(
          'Queue at capacity with no terminal entries — rejecting enqueue',
        );
        throw new QueueCapacityError();
      }
      const [evicted] = queue.splice(evictIndex, 1);
      queue.push(mutation);
      this.saveQueue(queue);

      logger.debug(
        `📥 Queue: Added mutation ${mutation.operationName} (${mutation.id}) for user ${mutation.userId}`,
      );

      // Only an AUTH_ERROR eviction is reported. SUCCESS replayed and FAILED
      // was already withdrawn, so neither has a local change left standing —
      // but an auth-parked entry's change has been on screen since it was made,
      // waiting for a sign-in, and evicting it here is the moment the queue
      // gives up on it. Reported rather than withdrawn in place: the store must
      // not reach back into the cache or the failure pipeline.
      return evicted?.status === QueueStatus.AUTH_ERROR ? evicted : null;
    }

    queue.push(mutation);
    this.saveQueue(queue);

    logger.debug(
      `📥 Queue: Added mutation ${mutation.operationName} (${mutation.id}) for user ${mutation.userId}`,
    );
    return null;
  }

  /**
   * Remove a mutation from the queue by ID
   */
  removeMutation(mutationId: string): boolean {
    const queue = this.loadQueue();
    const initialLength = queue.length;
    const filtered = queue.filter(m => m.id !== mutationId);

    if (filtered.length < initialLength) {
      this.saveQueue(filtered);
      logger.debug(`📤 Queue: Removed mutation ${mutationId}`);
      return true;
    }

    return false;
  }

  /**
   * Update a mutation's status and details
   */
  updateMutation(
    mutationId: string,
    updates: Partial<Omit<QueuedMutation, 'id' | 'userId' | 'mutation'>>,
  ): boolean {
    const queue = this.loadQueue();
    const index = queue.findIndex(m => m.id === mutationId);

    if (index === -1) return false;

    queue[index] = {
      ...queue[index],
      ...updates,
      updatedAt: Date.now(),
    };

    this.saveQueue(queue);
    return true;
  }

  /**
   * Get all mutations for a specific user
   */
  getMutationsForUser(userId: string, status?: QueueStatus): QueuedMutation[] {
    const queue = this.loadQueue();
    let filtered = queue.filter(m => m.userId === userId);

    if (status) {
      filtered = filtered.filter(m => m.status === status);
    }

    return filtered;
  }

  /**
   * Every PENDING mutation, whoever queued it, oldest first.
   *
   * Deliberately not user-scoped: the one caller runs at boot, before anything
   * has hydrated a user, and `CURRENT_USER_KEY` is only written on a user
   * CHANGE — so a session that has simply been signed in for a while has no
   * value there to scope by. Scoping is the persisted Apollo cache's job
   * instead: it is cleared on sign-out, so it holds only the current session's
   * entities and a write aimed at anyone else's names an entity that is not in
   * it.
   */
  getAllPendingMutations(): QueuedMutation[] {
    return this.loadQueue()
      .filter(m => m.status === QueueStatus.PENDING)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Get all pending mutations for a specific user (ordered by creation time)
   */
  getPendingMutationsForUser(userId: string): QueuedMutation[] {
    return this.getMutationsForUser(userId, QueueStatus.PENDING).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  /**
   * Reset stranded PROCESSING entries back to PENDING so the next drain
   * replays them. Drains are serialized in-process by queueManager's
   * isProcessing flag, so any PROCESSING entry observed at drain start is
   * debris from a process killed mid-replay — without this reset it would
   * never be replayed, never marked failed, and (being non-PENDING) lose
   * its pending-client-id merge protection. Replaying a possibly-committed
   * op is safe: replays are idempotent by design (client-minted PKs /
   * input.idempotencyKey). Returns the number of entries reset.
   */
  resetProcessingToPending(userId: string): number {
    const queue = this.loadQueue();
    let reset = 0;
    const updated = queue.map(m => {
      if (m.userId !== userId || m.status !== QueueStatus.PROCESSING) return m;
      reset++;
      return { ...m, status: QueueStatus.PENDING, updatedAt: Date.now() };
    });

    if (reset > 0) {
      this.saveQueue(updated);
      logger.info(
        `♻️ Queue: Reset ${reset} stranded PROCESSING mutation(s) to PENDING`,
      );
    }
    return reset;
  }

  /**
   * Mark PENDING entries older than the server's published idempotency-dedup
   * horizon as FAILED so they surface through the normal failure UX instead
   * of replaying into a potential double-apply. Runs at drain start (before
   * replay ordering) — expiry is age-based, so a FIFO queue can only expire
   * a prefix, never punch a hole mid dependency chain.
   *
   * Returns the expired ENTRIES, not a count: each one records a local change
   * that is now on screen with nothing that will ever send it, so the caller
   * has to withdraw it. Returning a number left the change standing forever,
   * with no way for the person to discover it or act on it.
   */
  expireStalePending(userId: string): QueuedMutation[] {
    const queue = this.loadQueue();
    const cutoff = Date.now() - this.replayHorizonDays * DAY_MS;
    const expired: QueuedMutation[] = [];
    const updated = queue.map(m => {
      if (
        m.userId !== userId ||
        m.status !== QueueStatus.PENDING ||
        m.createdAt > cutoff
      ) {
        return m;
      }
      const lastError: QueueError = {
        type: 'unknown',
        message: `Queued change expired: older than the ${this.replayHorizonDays}-day offline sync window`,
        code: 'OFFLINE_SYNC_WINDOW_EXPIRED',
        timestamp: Date.now(),
        retryable: false,
      };
      const failed = {
        ...m,
        status: QueueStatus.FAILED,
        updatedAt: Date.now(),
        lastError,
      };
      expired.push(failed);
      return failed;
    });

    if (expired.length > 0) {
      this.saveQueue(updated);
      logger.warn(
        `🧹 Queue: Expired ${expired.length} PENDING mutation(s) past the ${this.replayHorizonDays}-day sync window`,
      );
    }
    return expired;
  }

  /**
   * Client-generated entity ids that still have a PENDING mutation in the
   * current user's queue. The cache merge uses this to avoid dropping an
   * un-replayed optimistic item when a first-page background refetch lands
   * before the queue replays (a server-deleted item, by contrast, has no
   * pending op and is correctly dropped). Reads ids from every queued input
   * shape: `input.id`, else `input.itemId`, else top-level `id`, plus every
   * `input.items[].id` of batch-shaped creates (`AddItemsToShoppingListInput`).
   * Returns an empty set when no user is set or the queue is empty.
   */
  getPendingClientIds(): Set<string> {
    if (this.pendingClientIds) return this.pendingClientIds;

    const ids = new Set<string>();
    const userId = this.getCurrentUserId();
    if (userId) {
      for (const { variables } of this.getPendingMutationsForUser(userId)) {
        for (const id of queuedEntityIds(variables)) ids.add(id);
      }
    }
    this.pendingClientIds = ids;
    return ids;
  }

  /**
   * Get a specific mutation by ID
   */
  getMutation(mutationId: string): QueuedMutation | null {
    const queue = this.loadQueue();
    return queue.find(m => m.id === mutationId) || null;
  }

  /**
   * Clear all mutations for a specific user
   */
  clearQueueForUser(userId: string): number {
    const queue = this.loadQueue();
    const initialLength = queue.length;
    const filtered = queue.filter(m => m.userId !== userId);

    this.saveQueue(filtered);

    const removedCount = initialLength - filtered.length;
    if (removedCount > 0) {
      logger.debug(
        `🧹 Queue: Cleared ${removedCount} mutations for user ${userId}`,
      );
    }

    return removedCount;
  }

  /**
   * Clear the entire queue (all users)
   */
  clearAllQueues(): void {
    storage.remove(QUEUE_STORAGE_KEY);
    this.cache = null; // Invalidate cache
    this.pendingClientIds = null;
    logger.debug('🧹 Queue: Cleared all mutations');
    this.notifyListeners();
  }

  /**
   * Number of PENDING mutations for the current user — the "changes waiting
   * to sync" count surfaced in the offline banner. Returns 0 when no user is
   * set (logged out).
   */
  getPendingCount(): number {
    const userId = this.getCurrentUserId();
    if (!userId) return 0;
    return this.getMutationsForUser(userId, QueueStatus.PENDING).length;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(userId?: string): QueueStats {
    const queue = userId ? this.getMutationsForUser(userId) : this.loadQueue();

    const stats: QueueStats = {
      total: queue.length,
      pending: queue.filter(m => m.status === QueueStatus.PENDING).length,
      processing: queue.filter(m => m.status === QueueStatus.PROCESSING).length,
      failed: queue.filter(m => m.status === QueueStatus.FAILED).length,
      authErrors: queue.filter(m => m.status === QueueStatus.AUTH_ERROR).length,
    };

    // Calculate oldest mutation age
    const pendingMutations = queue.filter(
      m => m.status === QueueStatus.PENDING,
    );
    if (pendingMutations.length > 0) {
      const oldest = Math.min(...pendingMutations.map(m => m.createdAt));
      stats.oldestMutationAge = Date.now() - oldest;
    }

    return stats;
  }

  /**
   * Mark a mutation as failed with error details
   */
  markMutationFailed(
    mutationId: string,
    error: QueuedMutation['lastError'],
  ): boolean {
    return this.updateMutation(mutationId, {
      status:
        error?.type === 'auth' ? QueueStatus.AUTH_ERROR : QueueStatus.FAILED,
      lastError: error,
      // Stamped so `cleanupTerminal` can age these out. Without it a terminal
      // failure had no timestamp and lived in the queue forever.
      processedAt: Date.now(),
    });
  }

  /**
   * Increment retry count for a mutation
   */
  incrementRetry(mutationId: string): boolean {
    const mutation = this.getMutation(mutationId);
    if (!mutation) return false;

    return this.updateMutation(mutationId, {
      retryCount: mutation.retryCount + 1,
      status: QueueStatus.PENDING, // Reset to pending for retry
    });
  }

  /**
   * Clean up old successful mutations (keep last 24 hours for reconciliation)
   */
  cleanupTerminal(): QueuedMutation[] {
    const queue = this.loadQueue();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const discarded: QueuedMutation[] = [];
    const filtered = queue.filter(m => {
      if (!isTerminal(m.status)) return true;
      if (!m.processedAt) return true;
      if (m.processedAt > oneDayAgo) return true;
      discarded.push(m);
      return false;
    });

    if (discarded.length > 0) {
      this.saveQueue(filtered);
      logger.debug(
        `🧹 Queue: Cleaned up ${discarded.length} old terminal mutations`,
      );
    }

    // Returned rather than counted because an AUTH_ERROR entry still has its
    // local change on screen: aging it out is the moment the queue truly gives
    // up, and the caller withdraws it then.
    return discarded;
  }

  /**
   * Returns AUTH_ERROR entries to PENDING so the next drain replays them.
   *
   * An auth failure is not a refusal — the server never saw the write. The
   * queue parks it rather than dropping it, and a successful sign-in is the
   * event that makes it replayable again. Retries start fresh: the previous
   * count was spent against a token that no longer exists.
   */
  revivePendingAuthErrors(userId: string): number {
    const queue = this.loadQueue();
    let revived = 0;

    for (const mutation of queue) {
      if (mutation.userId !== userId) continue;
      if (mutation.status !== QueueStatus.AUTH_ERROR) continue;
      mutation.status = QueueStatus.PENDING;
      mutation.retryCount = 0;
      mutation.processedAt = undefined;
      revived++;
    }

    if (revived > 0) {
      this.saveQueue(queue);
      logger.info(
        `🔓 Queue: Revived ${revived} auth-parked mutation(s) for replay`,
      );
    }

    return revived;
  }

  /**
   * Invalidate cache (useful when switching users or debugging)
   */
  invalidateCache(): void {
    this.cache = null;
    this.pendingClientIds = null;
    this.currentUserId = undefined;
    if (__DEV__) {
      logger.debug('🔄 Queue: Cache invalidated');
    }
  }
}

// Singleton instance
export const queueStore = new QueueStore();
