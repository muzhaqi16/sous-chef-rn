import { storage } from '#storage/mmkv';
import { QueuedMutation, QueueStats, QueueStatus } from './types';

const QUEUE_STORAGE_KEY = 'apollo-mutation-queue';
const CURRENT_USER_KEY = 'apollo-queue-current-user';

/**
 * Persistent queue store using MMKV
 * Provides user-scoped mutation queuing with atomic operations
 */
export class QueueStore {
  // PERFORMANCE: In-memory cache to avoid repeated MMKV reads and JSON parsing
  // Write-through pattern: cache is updated on every write and invalidated on user change
  private cache: QueuedMutation[] | null = null;
  private cacheHits = 0;
  private cacheMisses = 0;

  /**
   * Load all mutations from storage
   * Uses in-memory cache with write-through pattern
   */
  private loadQueue(): QueuedMutation[] {
    try {
      // Return cached queue if available
      if (this.cache !== null) {
        this.cacheHits++;
        if (__DEV__ && this.cacheHits % 50 === 0) {
          console.log(
            `⚡ Queue cache stats: ${this.cacheHits} hits, ${this.cacheMisses} misses (${((this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100).toFixed(1)}% hit rate)`,
          );
        }
        return this.cache;
      }

      // Cache miss - load from storage
      this.cacheMisses++;
      const queueJson = storage.getString(QUEUE_STORAGE_KEY);
      if (!queueJson) {
        this.cache = [];
        return [];
      }

      const parsed = JSON.parse(queueJson);

      // Reconstruct DocumentNode from serialized string
      const queue = parsed.map((item: any) => ({
        ...item,
        mutation: JSON.parse(item.mutation), // Restore the mutation DocumentNode
      }));

      // Populate cache for future reads
      this.cache = queue;

      return queue;
    } catch (error) {
      console.error('Failed to load queue from storage:', error);
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
      console.error('Failed to save queue to storage:', error);
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
          console.log(
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
      console.warn('Queue size limit reached, removing oldest mutation');
      queue.shift(); // Remove oldest
    }

    queue.push(mutation);
    this.saveQueue(queue);

    console.log(
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
      console.log(`📤 Queue: Removed mutation ${mutationId}`);
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
      console.log(
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
    console.log('🧹 Queue: Cleared all mutations');
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
   * Get mutations that have exceeded max retries
   */
  getExceededRetryMutations(userId: string): QueuedMutation[] {
    return this.getMutationsForUser(userId).filter(
      m => m.retryCount >= m.maxRetries && m.status === QueueStatus.FAILED,
    );
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
      console.log(
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
      console.log('🔄 Queue: Cache invalidated');
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total > 0 ? (this.cacheHits / total) * 100 : 0,
    };
  }
}

// Singleton instance
export const queueStore = new QueueStore();
