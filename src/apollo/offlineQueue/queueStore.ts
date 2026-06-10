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
 * Persistent queue store using MMKV
 * Provides user-scoped mutation queuing with atomic operations
 */
export class QueueStore {
  // PERFORMANCE: In-memory cache to avoid repeated MMKV reads and JSON parsing
  // Write-through pattern: cache is updated on every write and invalidated on user change
  private cache: QueuedMutation[] | null = null;

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
  }

  /**
   * Get the current user ID
   */
  getCurrentUserId(): string | null {
    return storage.getString(CURRENT_USER_KEY) || null;
  }

  /**
   * Set the current user ID
   */
  setCurrentUserId(userId: string): void {
    storage.set(CURRENT_USER_KEY, userId);
  }

  /**
   * Clear the current user ID
   */
  clearCurrentUserId(): void {
    storage.remove(CURRENT_USER_KEY);
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
   * Client-generated entity ids that still have a PENDING mutation in the
   * current user's queue. The cache merge uses this to avoid dropping an
   * un-replayed optimistic item when a first-page background refetch lands
   * before the queue replays (a server-deleted item, by contrast, has no
   * pending op and is correctly dropped). Reads the id from the queued input
   * (`input.id`, else `input.itemId`, else top-level `id`). Returns an empty set
   * when no user is set or the queue is empty.
   */
  getPendingClientIds(): Set<string> {
    const userId = this.getCurrentUserId();
    if (!userId) return new Set();

    const ids = new Set<string>();
    for (const mutation of this.getPendingMutationsForUser(userId)) {
      const variables = mutation.variables as
        | { id?: unknown; input?: { id?: unknown; itemId?: unknown } }
        | undefined;
      const candidate =
        variables?.input?.id ?? variables?.input?.itemId ?? variables?.id;
      if (typeof candidate === 'string' && candidate) ids.add(candidate);
    }
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
    logger.debug('🧹 Queue: Cleared all mutations');
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
    if (__DEV__) {
      logger.debug('🔄 Queue: Cache invalidated');
    }
  }
}

// Singleton instance
export const queueStore = new QueueStore();
