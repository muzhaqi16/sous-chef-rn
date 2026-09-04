import type { DocumentNode } from 'graphql';
import { storage, isRecoveryStorage } from '#storage/mmkv';
import {
  QueueCapacityError,
  QueuedMutation,
  QueueError,
  QueueStats,
  QueueStatus,
} from './types';
import { logger } from '#/utils/environment';

const QUEUE_STORAGE_KEY = 'apollo-mutation-queue';
const CURRENT_USER_KEY = 'apollo-queue-current-user';

// Hard cap on total queued mutations across all users. When reached, terminal
// (SUCCESS/FAILED) entries are evicted first; a queue full of un-synced work
// rejects the enqueue rather than dropping a PENDING op mid dependency chain.
const MAX_QUEUE_SIZE = 100;

/**
 * Terminal = the queue will not replay it as things stand. AUTH_ERROR counts
 * as terminal for bookkeeping only ({@link QueueStore.revivePendingAuthErrors}
 * returns it on sign-in), but it must stay evictable or accumulated auth
 * failures wedge the queue at capacity.
 */
function isTerminal(status: QueueStatus): boolean {
  return (
    status === QueueStatus.SUCCESS ||
    status === QueueStatus.FAILED ||
    status === QueueStatus.AUTH_ERROR
  );
}

// The server prunes its idempotency-dedup records after 90 days, so a replay
// past that horizon double-applies instead of classifying as IDEMPOTENT_REPLAY.
// PENDING entries older than this are marked FAILED rather than replayed.
const MAX_PENDING_AGE_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * On-disk shape of a queued mutation: identical to {@link QueuedMutation}
 * except the `mutation` DocumentNode is stored as a serialized JSON string.
 */
type SerializedQueuedMutation = Omit<QueuedMutation, 'mutation'> & {
  mutation: string;
};

/**
 * Queued variables are duck-typed and ride a persistence boundary, so client-id
 * extraction guards at runtime instead of trusting a compile-time shape.
 */
const addIfClientId = (ids: Set<string>, value: unknown): void => {
  if (typeof value === 'string' && value) ids.add(value);
};

/** User-scoped mutation queue persisted to MMKV. */
export class QueueStore {
  // Write-through in-memory cache: updated on every write, invalidated on a
  // user change, so MMKV reads and JSON parsing don't repeat.
  private cache: QueuedMutation[] | null = null;

  // Mirror of CURRENT_USER_KEY (undefined = not yet read) plus the memoized
  // pending-ids set. getPendingClientIds() runs on EVERY itemsConnection merge
  // (cache.ts), so without these each write costs an MMKV read and a rebuild.
  private currentUserId: string | null | undefined = undefined;
  private pendingClientIds: Set<string> | null = null;

  // Lets UI read live queue state (the offline banner's pending count) through
  // useSyncExternalStore instead of polling MMKV.
  private listeners = new Set<() => void>();

  /** `useSyncExternalStore`-compatible; returns an unsubscribe function. */
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

  private loadQueue(): QueuedMutation[] {
    try {
      if (this.cache !== null) {
        return this.cache;
      }

      const queueJson = storage.getString(QUEUE_STORAGE_KEY);
      if (!queueJson) {
        this.cache = [];
        return [];
      }

      const parsed = JSON.parse(queueJson) as SerializedQueuedMutation[];

      const queue: QueuedMutation[] = parsed.map(item => ({
        ...item,
        mutation: JSON.parse(item.mutation) as DocumentNode,
      }));

      this.cache = queue;

      return queue;
    } catch (error) {
      logger.error('Failed to load queue from storage:', error);
      return [];
    }
  }

  private saveQueue(mutations: QueuedMutation[]): void {
    try {
      // The DocumentNode has to be serialized to survive MMKV.
      const serialized = mutations.map(m => ({
        ...m,
        mutation: JSON.stringify({
          kind: m.mutation.kind,
          definitions: m.mutation.definitions,
          loc: m.mutation.loc,
        }),
      }));

      // A queued mutation carries its full variables, so it is written only to
      // the encrypted instance. The in-memory cache below still updates, so a
      // quarantined session queues and replays normally within its lifetime.
      if (!isRecoveryStorage()) {
        storage.set(QUEUE_STORAGE_KEY, JSON.stringify(serialized));
      }

      this.cache = mutations;
    } catch (error) {
      logger.error('Failed to save queue to storage:', error);
    }
    this.pendingClientIds = null;
    this.notifyListeners();
  }

  getCurrentUserId(): string | null {
    if (this.currentUserId === undefined) {
      this.currentUserId = storage.getString(CURRENT_USER_KEY) || null;
    }
    return this.currentUserId;
  }

  setCurrentUserId(userId: string): void {
    if (!isRecoveryStorage()) {
      storage.set(CURRENT_USER_KEY, userId);
    }
    this.currentUserId = userId;
    this.pendingClientIds = null;
    // The pending count is user-scoped, so a user switch changes it even
    // though the queue contents didn't.
    this.notifyListeners();
  }

  clearCurrentUserId(): void {
    storage.remove(CURRENT_USER_KEY);
    this.currentUserId = null;
    this.pendingClientIds = null;
    this.notifyListeners();
  }

  /**
   * Repeated MoveShoppingListItem ops for one item coalesce into the last
   * position, so a drag only ever replays where the item finally landed.
   */
  addMutation(mutation: QueuedMutation): void {
    const queue = this.loadQueue();

    if (mutation.operationName === 'MoveShoppingListItem') {
      const itemId = mutation.variables?.input?.itemId;

      if (itemId) {
        const existingIndex = queue.findIndex(
          m =>
            m.operationName === 'MoveShoppingListItem' &&
            m.variables?.input?.itemId === itemId &&
            m.userId === mutation.userId &&
            m.status === QueueStatus.PENDING, // Only coalesce pending mutations
        );

        if (existingIndex !== -1) {
          logger.debug(
            `🔄 Queue: Coalescing move mutations for item ${itemId} - keeping final position`,
          );
          queue[existingIndex] = mutation;
          this.saveQueue(queue);
          return;
        }
      }
    }

    // Enforce the cap without ever dropping a PENDING op: that would break a
    // create→update chain, replaying the update against a create that never
    // happened. Prefer an entry already reconciled (SUCCESS replayed, FAILED
    // withdrawn); an AUTH_ERROR still has its change on screen, so it goes only
    // when it is all that is left. Nothing terminal at all means the queue is
    // full of un-synced work and the enqueue is refused.
    if (queue.length >= MAX_QUEUE_SIZE) {
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
      queue.splice(evictIndex, 1);
    }

    queue.push(mutation);
    this.saveQueue(queue);

    logger.debug(
      `📥 Queue: Added mutation ${mutation.operationName} (${mutation.id}) for user ${mutation.userId}`,
    );
  }

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

  getMutationsForUser(userId: string, status?: QueueStatus): QueuedMutation[] {
    const queue = this.loadQueue();
    let filtered = queue.filter(m => m.userId === userId);

    if (status) {
      filtered = filtered.filter(m => m.status === status);
    }

    return filtered;
  }

  /** Pending mutations for a user, oldest first. */
  getPendingMutationsForUser(userId: string): QueuedMutation[] {
    return this.getMutationsForUser(userId, QueueStatus.PENDING).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  /**
   * Drains are serialized, so a PROCESSING entry seen at drain start is debris
   * from a process killed mid-replay: left alone it is never replayed, never
   * failed, and loses its pending-client-id merge protection. Re-replaying a
   * possibly-committed op is safe — replays are idempotent by design.
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
   * PENDING entries past the 90-day dedup horizon become FAILED so they surface
   * through the normal failure UX instead of double-applying. Expiry is
   * age-based, so a FIFO queue can only expire a prefix, never punch a hole
   * mid dependency chain.
   */
  expireStalePending(userId: string): number {
    const queue = this.loadQueue();
    const cutoff = Date.now() - MAX_PENDING_AGE_MS;
    let expired = 0;
    const updated = queue.map(m => {
      if (
        m.userId !== userId ||
        m.status !== QueueStatus.PENDING ||
        m.createdAt > cutoff
      ) {
        return m;
      }
      expired++;
      const lastError: QueueError = {
        type: 'unknown',
        message:
          'Queued change expired: older than the 90-day offline sync window',
        code: 'OFFLINE_SYNC_WINDOW_EXPIRED',
        timestamp: Date.now(),
        retryable: false,
      };
      return {
        ...m,
        status: QueueStatus.FAILED,
        updatedAt: Date.now(),
        lastError,
      };
    });

    if (expired > 0) {
      this.saveQueue(updated);
      logger.warn(
        `🧹 Queue: Expired ${expired} PENDING mutation(s) past the 90-day sync window`,
      );
    }
    return expired;
  }

  /**
   * Client ids with a still-PENDING mutation. The cache merge uses this so a
   * first-page background refetch landing before replay does not drop an
   * un-replayed optimistic item; a server-deleted item has no pending op and is
   * correctly dropped. Empty when no user is set.
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
        // Batch creates mint one client id per item; the isArray guard covers
        // persisted entries whose shape predates the current enqueue path.
        const items = variables?.input?.items;
        if (Array.isArray(items)) {
          for (const item of items) addIfClientId(ids, item?.id);
        }
      }
    }
    this.pendingClientIds = ids;
    return ids;
  }

  getMutation(mutationId: string): QueuedMutation | null {
    const queue = this.loadQueue();
    return queue.find(m => m.id === mutationId) || null;
  }

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

  /** Clears every user's queue. */
  clearAllQueues(): void {
    storage.remove(QUEUE_STORAGE_KEY);
    this.cache = null;
    this.pendingClientIds = null;
    logger.debug('🧹 Queue: Cleared all mutations');
    this.notifyListeners();
  }

  /** The "changes waiting to sync" count the offline banner shows. */
  getPendingCount(): number {
    const userId = this.getCurrentUserId();
    if (!userId) return 0;
    return this.getMutationsForUser(userId, QueueStatus.PENDING).length;
  }

  getQueueStats(userId?: string): QueueStats {
    const queue = userId ? this.getMutationsForUser(userId) : this.loadQueue();

    const stats: QueueStats = {
      total: queue.length,
      pending: queue.filter(m => m.status === QueueStatus.PENDING).length,
      processing: queue.filter(m => m.status === QueueStatus.PROCESSING).length,
      failed: queue.filter(m => m.status === QueueStatus.FAILED).length,
      authErrors: queue.filter(m => m.status === QueueStatus.AUTH_ERROR).length,
    };

    const pendingMutations = queue.filter(
      m => m.status === QueueStatus.PENDING,
    );
    if (pendingMutations.length > 0) {
      const oldest = Math.min(...pendingMutations.map(m => m.createdAt));
      stats.oldestMutationAge = Date.now() - oldest;
    }

    return stats;
  }

  markMutationFailed(
    mutationId: string,
    error: QueuedMutation['lastError'],
  ): boolean {
    return this.updateMutation(mutationId, {
      status:
        error?.type === 'auth' ? QueueStatus.AUTH_ERROR : QueueStatus.FAILED,
      lastError: error,
      // `cleanupTerminal` ages entries out by this stamp; an unstamped terminal
      // failure lives in the queue forever.
      processedAt: Date.now(),
    });
  }

  incrementRetry(mutationId: string): boolean {
    const mutation = this.getMutation(mutationId);
    if (!mutation) return false;

    return this.updateMutation(mutationId, {
      retryCount: mutation.retryCount + 1,
      status: QueueStatus.PENDING,
    });
  }

  /** Ages out terminal entries older than 24h, returning what it discarded. */
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

    // Returned, not counted: an AUTH_ERROR entry still has its local change on
    // screen, and ageing it out is when the caller withdraws that change.
    return discarded;
  }

  /**
   * An auth failure is not a refusal — the server never saw the write — so the
   * queue parks it and a successful sign-in makes it replayable again. Retries
   * start fresh: the spent count belongs to a dead token.
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

  invalidateCache(): void {
    this.cache = null;
    this.pendingClientIds = null;
    this.currentUserId = undefined;
    if (__DEV__) {
      logger.debug('🔄 Queue: Cache invalidated');
    }
  }
}

export const queueStore = new QueueStore();
