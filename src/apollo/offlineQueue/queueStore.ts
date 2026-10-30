import type { DocumentNode } from 'graphql';
import { storage } from '#/store/deviceStorage';
import type { QueuedMutation, QueueError, QueueStats } from './types';
import { QueueCapacityError, QueueStatus } from './types';
import { logger } from '#/utils/environment';
import {
  deletesItsSubject,
  queuedSubject,
  type QueuedSubject,
} from './queuedSubject';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { MUTATION_DOCUMENTS } from '#/graphql/generated/mutationDocuments.generated';
import { MoveShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { isOwnKey } from '#/utils/isOwnKey';
import { isRecord } from '#/utils/isRecord';
import type { PendingWrite } from '#/apollo/pendingWrites/types';

const QUEUE_STORAGE_KEY = 'apollo-mutation-queue';
const CURRENT_USER_KEY = 'apollo-queue-current-user';

// Hard cap on total queued mutations across all users. When reached, terminal
// (SUCCESS/FAILED) entries are evicted first; a queue full of un-synced work
// rejects the enqueue rather than dropping a PENDING op mid dependency chain.
const MAX_QUEUE_SIZE = 100;

const MOVE_SHOPPING_LIST_ITEM = operationNameOf(MoveShoppingListItemDocument);

/** The item a queued move targets; entries are persisted JSON, read structurally. */
const movedItemIdOf = (mutation: QueuedMutation): string | undefined => {
  const input: unknown = mutation.variables.input;
  return isRecord(input) && typeof input.id === 'string' ? input.id : undefined;
};

/**
 * Not replayed as things stand. AUTH_ERROR is terminal for bookkeeping only
 * ({@link QueueStore.revivePendingAuthErrors} revives it on sign-in), but must
 * stay evictable or accumulated auth failures wedge the queue at capacity.
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

type StoredEntry = Omit<QueuedMutation, 'mutation'>;

/** What the server has not taken: pending, replaying, or parked for re-auth. */
const UNDELIVERED: readonly QueueStatus[] = [
  QueueStatus.PENDING,
  QueueStatus.PROCESSING,
  QueueStatus.AUTH_ERROR,
];

/** The memoized id sets the queue derives; any queue change drops them all. */
type IdSet = 'pending' | 'unconfirmed' | 'undelivered';

/** Entries without their documents: each is sent as this build's document. */
interface QueueBlob {
  v: 3;
  entries: StoredEntry[];
}

function serializeQueue(mutations: readonly QueuedMutation[]): string {
  const blob: QueueBlob = {
    v: 3,
    entries: mutations.map(({ mutation: _document, ...entry }) => entry),
  };
  return JSON.stringify(blob);
}

/** This build's document for an operation; undefined for one it does not declare. */
const currentDocumentOf = (operationName: string): DocumentNode | undefined =>
  isOwnKey(MUTATION_DOCUMENTS, operationName)
    ? MUTATION_DOCUMENTS[operationName]?.()
    : undefined;

/** User-scoped mutation queue persisted to MMKV. */
export class QueueStore {
  // Write-through in-memory cache: updated on every write, invalidated on a
  // user change, so MMKV reads and JSON parsing don't repeat.
  private cache: QueuedMutation[] | null = null;

  // Mirror of CURRENT_USER_KEY (undefined = not yet read) plus the memoized
  // id sets. The connection merge and the queue link read them on every
  // write, so without these each costs an MMKV read and a rebuild.
  private currentUserId: string | null | undefined = undefined;
  private idSets = new Map<IdSet, Set<string>>();

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

      const { entries } = JSON.parse(queueJson) as QueueBlob;
      const queue = entries.flatMap(entry => {
        const mutation = currentDocumentOf(entry.operationName);
        if (mutation) return [{ ...entry, mutation }];
        logger.warn(`Queue: dropped ${entry.operationName}, not in this build`);
        return [];
      });

      this.cache = queue;

      return queue;
    } catch (error) {
      logger.error('Failed to load queue from storage:', error);
      // Read once: the next save replaces what could not be read. Storage
      // that is not open yet is not that, so the next read tries again.
      if (storage.isReady()) this.cache = [];
      return [];
    }
  }

  private saveQueue(mutations: QueuedMutation[]): void {
    try {
      // A queued mutation carries its full variables, so it is written only to
      // the encrypted instance. The in-memory cache below still updates, so a
      // quarantined session queues and replays normally within its lifetime.
      if (!storage.isRecovery()) {
        storage.set(QUEUE_STORAGE_KEY, serializeQueue(mutations));
      }

      this.cache = mutations;
    } catch (error) {
      logger.error('Failed to save queue to storage:', error);
    }
    this.idSets.clear();
    this.notifyListeners();
  }

  getCurrentUserId(): string | null {
    if (this.currentUserId === undefined) {
      this.currentUserId = storage.getString(CURRENT_USER_KEY) ?? null;
    }
    return this.currentUserId;
  }

  setCurrentUserId(userId: string): void {
    if (!storage.isRecovery()) {
      storage.set(CURRENT_USER_KEY, userId);
    }
    this.currentUserId = userId;
    this.idSets.clear();
    // The pending count is user-scoped, so a user switch changes it even
    // though the queue contents didn't.
    this.notifyListeners();
  }

  clearCurrentUserId(): void {
    storage.remove(CURRENT_USER_KEY);
    this.currentUserId = null;
    this.idSets.clear();
    this.notifyListeners();
  }

  /**
   * Repeated MoveShoppingListItem ops for one item coalesce into the last. Its
   * age goes in `agedFrom`, not the drain-ordering `createdAt`, so it never
   * sorts ahead of a row created between the two moves that it names.
   */
  addMutation(mutation: QueuedMutation): void {
    const queue = this.loadQueue();

    if (mutation.operationName === MOVE_SHOPPING_LIST_ITEM) {
      const itemId = movedItemIdOf(mutation);

      if (itemId) {
        const existingIndex = queue.findIndex(
          m =>
            m.operationName === MOVE_SHOPPING_LIST_ITEM &&
            movedItemIdOf(m) === itemId &&
            m.userId === mutation.userId &&
            m.status === QueueStatus.PENDING, // Only coalesce pending mutations
        );

        const [superseded] =
          existingIndex === -1 ? [] : queue.splice(existingIndex, 1);
        if (superseded) {
          logger.debug(
            `🔄 Queue: Coalescing move mutations for item ${itemId} - keeping final position`,
          );
          // Appended, not written into the old slot: the drain replays in queue
          // order, and the final position can name a row created since.
          queue.push({
            ...mutation,
            agedFrom: superseded.agedFrom ?? superseded.createdAt,
          });
          this.saveQueue(queue);
          return;
        }
      }
    }

    if (
      deletesItsSubject(mutation) &&
      this.supersedeByDelete(queue, mutation)
    ) {
      return;
    }

    // Never drop a PENDING op: it would break a create→update chain. Evict a
    // reconciled entry first; an AUTH_ERROR still has its change on screen, so
    // it goes only when nothing else can. With none terminal, enqueue refuses.
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

  /**
   * Drops the pending (or re-auth-parked, non-minting) writes to the row a delete
   * removes: left queued, each holds the delete behind it. A row the server never
   * had takes the delete with it. Returns whether it settled the enqueue.
   */
  private supersedeByDelete(
    queue: QueuedMutation[],
    deletion: QueuedMutation,
  ): boolean {
    const [deletedId] = queuedSubject(deletion).subjectIds;
    if (!deletedId) return false;

    const kept: QueuedMutation[] = [];
    let oldest = Infinity;
    let mintedHere = false;
    for (const m of queue) {
      const { subjectIds, mintedIds } = queuedSubject(m);
      const superseded =
        m.userId === deletion.userId &&
        (m.status === QueueStatus.PENDING ||
          (m.status === QueueStatus.AUTH_ERROR && mintedIds.length === 0)) &&
        subjectIds.length > 0 &&
        subjectIds.every(id => id === deletedId);
      if (!superseded) {
        kept.push(m);
        continue;
      }
      oldest = Math.min(oldest, m.agedFrom ?? m.createdAt);
      mintedHere ||= mintedIds.length > 0;
    }
    const supersededCount = queue.length - kept.length;
    if (supersededCount === 0) return false;

    logger.debug(
      `🔄 Queue: ${deletion.operationName} supersedes ${supersededCount} pending write(s) to ${deletedId}`,
    );
    if (!mintedHere) {
      kept.push({ ...deletion, agedFrom: deletion.agedFrom ?? oldest });
    }
    this.saveQueue(kept);
    return true;
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

    const existing = queue[index];
    if (!existing) return false;

    queue[index] = {
      ...existing,
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
   * Drains are serialized, so a PROCESSING entry at drain start is debris from
   * a process killed mid-replay. Re-replaying a possibly-committed op is safe,
   * as replays are idempotent.
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
   * PENDING entries past the dedup horizon become FAILED, surfacing through the
   * failure UX instead of double-applying. Age-based, so a FIFO queue expires
   * only a prefix, never a hole mid dependency chain.
   */
  expireStalePending(
    userId: string,
  ): Array<QueuedMutation & { lastError: QueueError }> {
    const queue = this.loadQueue();
    const now = Date.now();
    const cutoff = now - MAX_PENDING_AGE_MS;
    const expired: Array<QueuedMutation & { lastError: QueueError }> = [];
    const updated = queue.map(m => {
      if (
        m.userId !== userId ||
        m.status !== QueueStatus.PENDING ||
        (m.agedFrom ?? m.createdAt) > cutoff
      ) {
        return m;
      }
      const lastError: QueueError = {
        type: 'unknown',
        message:
          'Queued change expired: older than the 90-day offline sync window',
        code: 'OFFLINE_SYNC_WINDOW_EXPIRED',
        timestamp: now,
        retryable: false,
      };
      const failed = {
        ...m,
        status: QueueStatus.FAILED,
        updatedAt: now,
        processedAt: now,
        lastError,
      };
      expired.push(failed);
      return failed;
    });

    if (expired.length > 0) {
      this.saveQueue(updated);
      logger.warn(
        `🧹 Queue: Expired ${expired.length} PENDING mutation(s) past the 90-day sync window`,
      );
    }
    return expired;
  }

  /**
   * Client ids with a still-PENDING mutation; empty when no user is set.
   */
  getPendingClientIds(): Set<string> {
    return this.idsOf('pending', [QueueStatus.PENDING], s => s.subjectIds);
  }

  /**
   * Ids minted for a create still PENDING or PROCESSING, which a first page
   * would drop. Narrower than {@link getPendingClientIds}: an update names a row
   * the server owns, and counting it pins it into lists it left.
   */
  getUnconfirmedCreateIds(): Set<string> {
    return this.idsOf(
      'unconfirmed',
      [QueueStatus.PENDING, QueueStatus.PROCESSING],
      s => s.mintedIds,
    );
  }

  /** The pending writes the server has not taken, in the order they replay. */
  getPendingWrites(): PendingWrite[] {
    const userId = this.getCurrentUserId();
    if (!userId) return [];
    return this.getMutationsForUser(userId)
      .filter(({ status }) => UNDELIVERED.includes(status))
      .sort((a, b) => a.createdAt - b.createdAt)
      .flatMap(({ pendingWrite, operationName, variables }) =>
        pendingWrite ? [{ ...pendingWrite, operationName, variables }] : [],
      );
  }

  /** The ids of the pending writes the queue carries, whatever their status. */
  getQueuedWriteIds(): Set<string> {
    return new Set(
      this.loadQueue().flatMap(({ pendingWrite }) =>
        pendingWrite ? [pendingWrite.id] : [],
      ),
    );
  }

  /**
   * Rows a write the server has not taken yet changes: pending, replaying, or
   * parked for re-auth. A later write naming one waits behind it, as the
   * drain holds a dependent.
   */
  getUndeliveredIds(): Set<string> {
    return this.idsOf('undelivered', UNDELIVERED, s => s.subjectIds);
  }

  private idsOf(
    set: IdSet,
    statuses: readonly QueueStatus[],
    pick: (subject: QueuedSubject) => readonly string[],
  ): Set<string> {
    const known = this.idSets.get(set);
    if (known) return known;

    const ids = new Set<string>();
    const userId = this.getCurrentUserId();
    if (userId) {
      for (const status of statuses) {
        for (const mutation of this.getMutationsForUser(userId, status)) {
          for (const id of pick(queuedSubject(mutation))) ids.add(id);
        }
      }
    }
    this.idSets.set(set, ids);
    return ids;
  }

  getMutation(mutationId: string): QueuedMutation | null {
    const queue = this.loadQueue();
    return queue.find(m => m.id === mutationId) ?? null;
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
    this.idSets.clear();
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
    this.idSets.clear();
    this.currentUserId = undefined;
    // A pending-write badge reads through the cache; it must re-read now.
    this.notifyListeners();
    if (__DEV__) {
      logger.debug('🔄 Queue: Cache invalidated');
    }
  }
}

export const queueStore = new QueueStore();
