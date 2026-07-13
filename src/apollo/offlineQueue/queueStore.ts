import type { DocumentNode } from 'graphql';
import { storage } from '#storage/mmkv';
import { QueuedMutation, QueueStats, QueueStatus } from './types';
import { logger } from '#/utils/environment';

const QUEUE_STORAGE_KEY = 'apollo-mutation-queue';
const CURRENT_USER_KEY = 'apollo-queue-current-user';

/**
 * On-disk shape of a queued mutation: identical to {@link QueuedMutation}
 * except the `mutation` DocumentNode is stored as a serialized JSON string.
 */
type SerializedQueuedMutation = Omit<QueuedMutation, 'mutation'> & {
  mutation: string;
};

/**
 * Add `value` to `ids` when it is a non-empty string. Queued variables are
 * duck-typed (`OperationVariables` spans every queued operation and rides a
 * persistence boundary), so client-id extraction guards at runtime instead of
 * trusting a compile-time shape.
 */
const addIfClientId = (ids: Set<string>, value: unknown): void => {
  if (typeof value === 'string' && value) ids.add(value);
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

  // Subscribers notified on every queue change (add/remove/update/clear and
  // user switches). Lets UI read live queue state — e.g. the offline banner's
  // pending-changes count — via useSyncExternalStore without polling MMKV.
  private listeners = new Set<() => void>();

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
  addMutation(mutation: QueuedMutation): void {
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
          return;
        }
      }
    }

    // Regular add logic for non-move mutations or first move
    // Check queue size limit
    if (queue.length >= 100) {
      logger.warn('Queue size limit reached, removing oldest mutation');
      queue.shift(); // Remove oldest
    }

    queue.push(mutation);
    this.saveQueue(queue);

    logger.debug(
      `📥 Queue: Added mutation ${mutation.operationName} (${mutation.id}) for user ${mutation.userId}`,
    );
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
        addIfClientId(
          ids,
          variables?.input?.id ?? variables?.input?.itemId ?? variables?.id,
        );
        // Batch-shaped creates (AddItemsToShoppingListInput) mint one client
        // id per item. Array.isArray guards persisted entries from older
        // builds whose shape may not match what the app enqueues today.
        const items = variables?.input?.items;
        if (Array.isArray(items)) {
          for (const item of items) addIfClientId(ids, item?.id);
        }
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
  cleanupSuccessful(): number {
    const queue = this.loadQueue();
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const initialLength = queue.length;

    const filtered = queue.filter(m => {
      if (m.status !== QueueStatus.SUCCESS) return true;
      if (!m.processedAt) return true;
      return m.processedAt > oneDayAgo;
    });

    if (filtered.length < initialLength) {
      this.saveQueue(filtered);
      logger.debug(
        `🧹 Queue: Cleaned up ${
          initialLength - filtered.length
        } old successful mutations`,
      );
    }

    return initialLength - filtered.length;
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
