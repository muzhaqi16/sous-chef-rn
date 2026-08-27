import type { DocumentNode } from 'graphql';
import { QueueStore } from '../queueStore';
import { QueueCapacityError, QueuedMutation, QueueStatus } from '../types';
import { storage } from '#storage/mmkv';

// The global jest.setup.js already mocks react-native-mmkv with an in-memory Map,
// which means `storage` from '#storage/mmkv' is backed by that Map mock.

/** Helper to build a QueuedMutation with sensible defaults */
function makeMutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: `mut-${Math.random().toString(36).slice(2, 8)}`,
    userId: 'user-1',
    operationName: 'TestMutation',
    mutation: {
      kind: 'Document',
      definitions: [],
    } as DocumentNode,
    variables: {},
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
    ...overrides,
  };
}

describe('QueueStore', () => {
  let store: QueueStore;

  beforeEach(() => {
    // Fresh store for every test so cache / storage don't leak
    store = new QueueStore();
    // Clear underlying MMKV mock
    storage.clearAll();
  });

  // -------------------------------------------------------------------------
  // subscribe / getPendingCount
  // -------------------------------------------------------------------------
  describe('subscribe / getPendingCount', () => {
    it('notifies listeners on queue changes and reports the live pending count', () => {
      const listener = jest.fn();
      store.subscribe(listener);
      store.setCurrentUserId('user-1');
      listener.mockClear();

      store.addMutation(makeMutation({ id: 'p-1' }));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.getPendingCount()).toBe(1);

      store.removeMutation('p-1');
      expect(store.getPendingCount()).toBe(0);
    });

    it('counts only PENDING mutations belonging to the current user', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(makeMutation({ id: 'a', userId: 'user-1' }));
      store.addMutation(makeMutation({ id: 'b', userId: 'user-2' }));
      store.addMutation(
        makeMutation({
          id: 'c',
          userId: 'user-1',
          status: QueueStatus.FAILED,
        }),
      );

      expect(store.getPendingCount()).toBe(1);
    });

    it('returns 0 when no current user is set', () => {
      store.addMutation(makeMutation());
      expect(store.getPendingCount()).toBe(0);
    });

    it('stops notifying after unsubscribe', () => {
      const listener = jest.fn();
      const unsubscribe = store.subscribe(listener);
      unsubscribe();

      store.addMutation(makeMutation());
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // addMutation
  // -------------------------------------------------------------------------
  describe('addMutation', () => {
    it('adds a mutation and persists it', () => {
      const m = makeMutation({ id: 'add-1' });
      store.addMutation(m);

      const result = store.getMutationsForUser('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('add-1');
    });

    it('evicts the oldest terminal entry at capacity, preserving PENDING ops', () => {
      // Oldest entry is terminal (SUCCESS); the rest are un-synced PENDING.
      store.addMutation(
        makeMutation({ id: 'done-0', status: QueueStatus.SUCCESS }),
      );
      for (let i = 0; i < 99; i++) {
        store.addMutation(makeMutation({ id: `pending-${i}` }));
      }

      // The 101st enqueue evicts the terminal entry, never a PENDING op.
      store.addMutation(makeMutation({ id: 'overflow' }));

      const all = store.getMutationsForUser('user-1');
      expect(all).toHaveLength(100);
      expect(all.find(m => m.id === 'done-0')).toBeUndefined();
      expect(all.find(m => m.id === 'pending-0')).toBeDefined();
      expect(all.find(m => m.id === 'overflow')).toBeDefined();
    });

    it('evicts an AUTH_ERROR at capacity rather than wedging the queue', () => {
      // AUTH_ERROR belongs in the terminal set. Excluded, it is neither aged
      // out nor evictable, so 100 accumulated auth failures wedge the queue
      // permanently — every later offline write throwing QueueCapacityError
      // with no way back short of a reinstall.
      for (let i = 0; i < 100; i++) {
        store.addMutation(
          makeMutation({ id: `auth-${i}`, status: QueueStatus.AUTH_ERROR }),
        );
      }

      expect(() =>
        store.addMutation(makeMutation({ id: 'new-write' })),
      ).not.toThrow();

      const all = store.getMutationsForUser('user-1');
      expect(all).toHaveLength(100);
      expect(all.find(m => m.id === 'new-write')).toBeDefined();
      expect(all.find(m => m.id === 'auth-0')).toBeUndefined();
    });

    it('takes a reconciled entry before an auth-parked one at capacity', () => {
      // A SUCCESS replayed and a FAILED was withdrawn, so dropping either loses
      // nothing. An AUTH_ERROR still has its local change on screen waiting for
      // a sign-in to replay it, so it goes last.
      store.addMutation(
        makeMutation({ id: 'parked-0', status: QueueStatus.AUTH_ERROR }),
      );
      store.addMutation(
        makeMutation({ id: 'done-0', status: QueueStatus.SUCCESS }),
      );
      for (let i = 0; i < 98; i++) {
        store.addMutation(makeMutation({ id: `pending-${i}` }));
      }

      store.addMutation(makeMutation({ id: 'overflow' }));

      const all = store.getMutationsForUser('user-1');
      expect(all.find(m => m.id === 'done-0')).toBeUndefined();
      expect(all.find(m => m.id === 'parked-0')).toBeDefined();
    });

    it('rejects the enqueue when the queue is full of un-synced PENDING work', () => {
      for (let i = 0; i < 100; i++) {
        store.addMutation(makeMutation({ id: `fill-${i}` }));
      }

      expect(() => store.addMutation(makeMutation({ id: 'overflow' }))).toThrow(
        QueueCapacityError,
      );

      // No PENDING op was dropped and the rejected op was not added.
      const all = store.getMutationsForUser('user-1');
      expect(all).toHaveLength(100);
      expect(all.find(m => m.id === 'fill-0')).toBeDefined();
      expect(all.find(m => m.id === 'overflow')).toBeUndefined();
    });

    describe('MoveShoppingListItem coalescing', () => {
      it('coalesces pending move mutations for the same item', () => {
        const move1 = makeMutation({
          id: 'move-1',
          operationName: 'MoveShoppingListItem',
          variables: { input: { itemId: 'item-A', afterId: 'x' } },
        });
        const move2 = makeMutation({
          id: 'move-2',
          operationName: 'MoveShoppingListItem',
          variables: { input: { itemId: 'item-A', afterId: 'y' } },
        });

        store.addMutation(move1);
        store.addMutation(move2);

        const result = store.getMutationsForUser('user-1');
        expect(result).toHaveLength(1);
        // The second (latest) mutation should win
        expect(result[0].id).toBe('move-2');
        expect(result[0].variables.input.afterId).toBe('y');
      });

      it('does not coalesce move mutations for different items', () => {
        store.addMutation(
          makeMutation({
            id: 'move-a',
            operationName: 'MoveShoppingListItem',
            variables: { input: { itemId: 'item-A' } },
          }),
        );
        store.addMutation(
          makeMutation({
            id: 'move-b',
            operationName: 'MoveShoppingListItem',
            variables: { input: { itemId: 'item-B' } },
          }),
        );

        expect(store.getMutationsForUser('user-1')).toHaveLength(2);
      });

      it('does not coalesce move mutations from different users', () => {
        store.addMutation(
          makeMutation({
            id: 'move-u1',
            userId: 'user-1',
            operationName: 'MoveShoppingListItem',
            variables: { input: { itemId: 'item-A' } },
          }),
        );
        store.addMutation(
          makeMutation({
            id: 'move-u2',
            userId: 'user-2',
            operationName: 'MoveShoppingListItem',
            variables: { input: { itemId: 'item-A' } },
          }),
        );

        const u1 = store.getMutationsForUser('user-1');
        const u2 = store.getMutationsForUser('user-2');
        expect(u1).toHaveLength(1);
        expect(u2).toHaveLength(1);
      });

      it('does not coalesce non-pending move mutations', () => {
        store.addMutation(
          makeMutation({
            id: 'move-processing',
            operationName: 'MoveShoppingListItem',
            variables: { input: { itemId: 'item-A' } },
            status: QueueStatus.PROCESSING,
          }),
        );
        store.addMutation(
          makeMutation({
            id: 'move-new',
            operationName: 'MoveShoppingListItem',
            variables: { input: { itemId: 'item-A' } },
          }),
        );

        expect(store.getMutationsForUser('user-1')).toHaveLength(2);
      });
    });
  });

  // -------------------------------------------------------------------------
  // removeMutation
  // -------------------------------------------------------------------------
  describe('removeMutation', () => {
    it('removes a mutation by ID and returns true', () => {
      store.addMutation(makeMutation({ id: 'rm-1' }));
      const removed = store.removeMutation('rm-1');
      expect(removed).toBe(true);
      expect(store.getMutationsForUser('user-1')).toHaveLength(0);
    });

    it('returns false when mutation does not exist', () => {
      expect(store.removeMutation('nonexistent')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // updateMutation
  // -------------------------------------------------------------------------
  describe('updateMutation', () => {
    it('updates the fields of an existing mutation', () => {
      store.addMutation(makeMutation({ id: 'upd-1' }));
      const updated = store.updateMutation('upd-1', {
        status: QueueStatus.PROCESSING,
      });
      expect(updated).toBe(true);

      const m = store.getMutation('upd-1');
      expect(m?.status).toBe(QueueStatus.PROCESSING);
      expect(m?.updatedAt).toBeGreaterThan(0);
    });

    it('returns false when mutation does not exist', () => {
      expect(store.updateMutation('nope', { status: QueueStatus.FAILED })).toBe(
        false,
      );
    });

    it('does not overwrite id, userId, or mutation fields', () => {
      const original = makeMutation({ id: 'upd-2', userId: 'user-1' });
      store.addMutation(original);

      // Attempt to update with forbidden fields (type system prevents, but test runtime)
      store.updateMutation('upd-2', { status: QueueStatus.SUCCESS });

      const m = store.getMutation('upd-2');
      expect(m?.id).toBe('upd-2');
      expect(m?.userId).toBe('user-1');
    });
  });

  // -------------------------------------------------------------------------
  // getMutationsForUser
  // -------------------------------------------------------------------------
  describe('getMutationsForUser', () => {
    it('returns only mutations for the given user', () => {
      store.addMutation(makeMutation({ id: 'm1', userId: 'user-1' }));
      store.addMutation(makeMutation({ id: 'm2', userId: 'user-2' }));
      store.addMutation(makeMutation({ id: 'm3', userId: 'user-1' }));

      const u1 = store.getMutationsForUser('user-1');
      expect(u1).toHaveLength(2);
      expect(u1.map(m => m.id).sort()).toEqual(['m1', 'm3']);
    });

    it('filters by status when provided', () => {
      store.addMutation(
        makeMutation({ id: 's1', status: QueueStatus.PENDING }),
      );
      store.addMutation(makeMutation({ id: 's2', status: QueueStatus.FAILED }));
      store.addMutation(
        makeMutation({ id: 's3', status: QueueStatus.PENDING }),
      );

      const pending = store.getMutationsForUser('user-1', QueueStatus.PENDING);
      expect(pending).toHaveLength(2);
    });

    it('returns empty array for unknown user', () => {
      expect(store.getMutationsForUser('nobody')).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getPendingMutationsForUser
  // -------------------------------------------------------------------------
  describe('getPendingMutationsForUser', () => {
    it('returns pending mutations sorted by createdAt ascending', () => {
      store.addMutation(
        makeMutation({
          id: 'p1',
          status: QueueStatus.PENDING,
          createdAt: 3000,
        }),
      );
      store.addMutation(
        makeMutation({
          id: 'p2',
          status: QueueStatus.PENDING,
          createdAt: 1000,
        }),
      );
      store.addMutation(
        makeMutation({
          id: 'p3',
          status: QueueStatus.PENDING,
          createdAt: 2000,
        }),
      );
      // Non-pending should be excluded
      store.addMutation(
        makeMutation({
          id: 'f1',
          status: QueueStatus.FAILED,
          createdAt: 500,
        }),
      );

      const pending = store.getPendingMutationsForUser('user-1');
      expect(pending).toHaveLength(3);
      expect(pending[0].id).toBe('p2');
      expect(pending[1].id).toBe('p3');
      expect(pending[2].id).toBe('p1');
    });
  });

  // -------------------------------------------------------------------------
  // clearQueueForUser
  // -------------------------------------------------------------------------
  describe('clearQueueForUser', () => {
    it('removes all mutations for the specified user', () => {
      store.addMutation(makeMutation({ id: 'c1', userId: 'user-1' }));
      store.addMutation(makeMutation({ id: 'c2', userId: 'user-1' }));
      store.addMutation(makeMutation({ id: 'c3', userId: 'user-2' }));

      const count = store.clearQueueForUser('user-1');
      expect(count).toBe(2);
      expect(store.getMutationsForUser('user-1')).toHaveLength(0);
      expect(store.getMutationsForUser('user-2')).toHaveLength(1);
    });

    it('returns 0 when user has no mutations', () => {
      expect(store.clearQueueForUser('nobody')).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getQueueStats
  // -------------------------------------------------------------------------
  describe('getQueueStats', () => {
    it('returns correct counts by status', () => {
      store.addMutation(makeMutation({ status: QueueStatus.PENDING }));
      store.addMutation(makeMutation({ status: QueueStatus.PENDING }));
      store.addMutation(makeMutation({ status: QueueStatus.PROCESSING }));
      store.addMutation(makeMutation({ status: QueueStatus.FAILED }));
      store.addMutation(makeMutation({ status: QueueStatus.AUTH_ERROR }));
      store.addMutation(makeMutation({ status: QueueStatus.SUCCESS }));

      const stats = store.getQueueStats('user-1');
      expect(stats.total).toBe(6);
      expect(stats.pending).toBe(2);
      expect(stats.processing).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.authErrors).toBe(1);
    });

    it('includes oldestMutationAge when pending mutations exist', () => {
      const oldTime = Date.now() - 60000; // 1 minute ago
      store.addMutation(
        makeMutation({ status: QueueStatus.PENDING, createdAt: oldTime }),
      );

      const stats = store.getQueueStats('user-1');
      expect(stats.oldestMutationAge).toBeDefined();
      expect(stats.oldestMutationAge!).toBeGreaterThanOrEqual(59000);
    });

    it('does not include oldestMutationAge when no pending mutations', () => {
      store.addMutation(makeMutation({ status: QueueStatus.FAILED }));
      const stats = store.getQueueStats('user-1');
      expect(stats.oldestMutationAge).toBeUndefined();
    });

    it('returns global stats when no userId provided', () => {
      store.addMutation(
        makeMutation({
          userId: 'user-1',
          status: QueueStatus.PENDING,
        }),
      );
      store.addMutation(
        makeMutation({
          userId: 'user-2',
          status: QueueStatus.PENDING,
        }),
      );

      const stats = store.getQueueStats();
      expect(stats.total).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // markMutationFailed
  // -------------------------------------------------------------------------
  describe('markMutationFailed', () => {
    it('marks mutation as FAILED for non-auth errors', () => {
      store.addMutation(makeMutation({ id: 'fail-1' }));
      const result = store.markMutationFailed('fail-1', {
        type: 'network',
        message: 'timeout',
        timestamp: Date.now(),
        retryable: true,
      });
      expect(result).toBe(true);

      const m = store.getMutation('fail-1');
      expect(m?.status).toBe(QueueStatus.FAILED);
      expect(m?.lastError?.type).toBe('network');
    });

    it('marks mutation as AUTH_ERROR for auth errors', () => {
      store.addMutation(makeMutation({ id: 'auth-1' }));
      const result = store.markMutationFailed('auth-1', {
        type: 'auth',
        message: 'unauthorized',
        timestamp: Date.now(),
        retryable: true,
      });
      expect(result).toBe(true);

      const m = store.getMutation('auth-1');
      expect(m?.status).toBe(QueueStatus.AUTH_ERROR);
    });

    it('returns false for non-existent mutation', () => {
      expect(
        store.markMutationFailed('nope', {
          type: 'unknown',
          message: 'test',
          timestamp: Date.now(),
          retryable: false,
        }),
      ).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // incrementRetry
  // -------------------------------------------------------------------------
  describe('incrementRetry', () => {
    it('increments retryCount and resets status to PENDING', () => {
      store.addMutation(
        makeMutation({
          id: 'retry-1',
          retryCount: 1,
          status: QueueStatus.FAILED,
        }),
      );

      const result = store.incrementRetry('retry-1');
      expect(result).toBe(true);

      const m = store.getMutation('retry-1');
      expect(m?.retryCount).toBe(2);
      expect(m?.status).toBe(QueueStatus.PENDING);
    });

    it('returns false for non-existent mutation', () => {
      expect(store.incrementRetry('nope')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // cleanupTerminal
  // -------------------------------------------------------------------------
  describe('cleanupTerminal', () => {
    it('removes successful mutations older than 24 hours', () => {
      const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
      store.addMutation(
        makeMutation({
          id: 'old-success',
          status: QueueStatus.SUCCESS,
          processedAt: twoDaysAgo,
        }),
      );
      // Recent success should be kept
      store.addMutation(
        makeMutation({
          id: 'recent-success',
          status: QueueStatus.SUCCESS,
          processedAt: Date.now() - 3600000, // 1 hour ago
        }),
      );
      // Non-success should be kept
      store.addMutation(
        makeMutation({
          id: 'pending-1',
          status: QueueStatus.PENDING,
        }),
      );

      const removed = store.cleanupTerminal();
      expect(removed.map(m => m.id)).toEqual(['old-success']);

      const remaining = store.getMutationsForUser('user-1');
      expect(remaining).toHaveLength(2);
      expect(remaining.find(m => m.id === 'old-success')).toBeUndefined();
      expect(remaining.find(m => m.id === 'recent-success')).toBeDefined();
      expect(remaining.find(m => m.id === 'pending-1')).toBeDefined();
    });

    it('keeps successful mutations without processedAt', () => {
      store.addMutation(
        makeMutation({
          id: 'no-processed-at',
          status: QueueStatus.SUCCESS,
          // processedAt intentionally omitted
        }),
      );

      const removed = store.cleanupTerminal();
      expect(removed).toEqual([]);
      expect(store.getMutation('no-processed-at')).toBeDefined();
    });

    it('returns nothing when there is nothing to clean', () => {
      store.addMutation(makeMutation({ status: QueueStatus.PENDING }));
      expect(store.cleanupTerminal()).toEqual([]);
    });

    it('ages out FAILED and AUTH_ERROR, not only SUCCESS', () => {
      // A filter matching SUCCESS only keeps these forever, so a terminal
      // failure occupies queue capacity for the life of the install.
      const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;
      store.addMutation(
        makeMutation({
          id: 'old-failed',
          status: QueueStatus.FAILED,
          processedAt: twoDaysAgo,
        }),
      );
      store.addMutation(
        makeMutation({
          id: 'old-auth-error',
          status: QueueStatus.AUTH_ERROR,
          processedAt: twoDaysAgo,
        }),
      );

      // Returned rather than counted: an AUTH_ERROR still has its local change
      // on screen, and the caller withdraws it when the entry is discarded.
      expect(
        store
          .cleanupTerminal()
          .map(m => m.id)
          .sort(),
      ).toEqual(['old-auth-error', 'old-failed']);
      expect(store.getMutation('old-failed')).toBeNull();
      expect(store.getMutation('old-auth-error')).toBeNull();
    });

    it('revives auth-parked entries so the next drain replays them', () => {
      // An auth failure is not a refusal — the server never saw the write. A
      // sign-in is what makes it replayable again, and retries start fresh
      // because the old count was spent against a token that no longer exists.
      store.addMutation(
        makeMutation({
          id: 'parked',
          status: QueueStatus.AUTH_ERROR,
          retryCount: 3,
          processedAt: Date.now(),
        }),
      );

      expect(store.revivePendingAuthErrors('user-1')).toBe(1);

      const revived = store.getMutation('parked');
      expect(revived?.status).toBe(QueueStatus.PENDING);
      expect(revived?.retryCount).toBe(0);
      expect(revived?.processedAt).toBeUndefined();
      expect(store.getPendingMutationsForUser('user-1')).toHaveLength(1);
    });

    it('leaves a refused entry parked when reviving', () => {
      store.addMutation(
        makeMutation({ id: 'refused', status: QueueStatus.FAILED }),
      );
      expect(store.revivePendingAuthErrors('user-1')).toBe(0);
      expect(store.getMutation('refused')?.status).toBe(QueueStatus.FAILED);
    });

    it("does not revive another user's parked entries", () => {
      store.addMutation(
        makeMutation({
          id: 'theirs',
          userId: 'user-2',
          status: QueueStatus.AUTH_ERROR,
        }),
      );
      expect(store.revivePendingAuthErrors('user-1')).toBe(0);
      expect(store.getMutation('theirs')?.status).toBe(QueueStatus.AUTH_ERROR);
    });

    it('stamps processedAt when marking a mutation failed', () => {
      // Without the stamp a terminal failure has no age and can never be
      // cleaned, whatever the retention rule says.
      store.addMutation(makeMutation({ id: 'to-fail' }));
      store.markMutationFailed('to-fail', {
        type: 'server',
        message: 'nope',
        retryable: false,
        timestamp: Date.now(),
      });

      expect(store.getMutation('to-fail')?.processedAt).toEqual(
        expect.any(Number),
      );
    });
  });

  // -------------------------------------------------------------------------
  // MMKV persistence round-trip
  // -------------------------------------------------------------------------
  describe('persistence', () => {
    it('survives cache invalidation (reloads from MMKV)', () => {
      store.addMutation(makeMutation({ id: 'persist-1' }));

      // Invalidate cache, forcing reload from storage
      store.invalidateCache();

      const m = store.getMutation('persist-1');
      expect(m).not.toBeNull();
      expect(m?.id).toBe('persist-1');
    });
  });

  // -------------------------------------------------------------------------
  // User ID management
  // -------------------------------------------------------------------------
  describe('user ID management', () => {
    it('set / get / clear current user ID', () => {
      expect(store.getCurrentUserId()).toBeNull();

      store.setCurrentUserId('user-42');
      expect(store.getCurrentUserId()).toBe('user-42');

      store.clearCurrentUserId();
      expect(store.getCurrentUserId()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // clearAllQueues
  // -------------------------------------------------------------------------
  describe('clearAllQueues', () => {
    it('removes everything and invalidates cache', () => {
      store.addMutation(makeMutation({ userId: 'user-1' }));
      store.addMutation(makeMutation({ userId: 'user-2' }));

      store.clearAllQueues();

      expect(store.getMutationsForUser('user-1')).toHaveLength(0);
      expect(store.getMutationsForUser('user-2')).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // resetProcessingToPending
  // -------------------------------------------------------------------------
  describe('resetProcessingToPending', () => {
    it('flips stranded PROCESSING entries back to PENDING', () => {
      store.addMutation(
        makeMutation({ id: 'stranded-1', status: QueueStatus.PROCESSING }),
      );
      store.addMutation(
        makeMutation({ id: 'stranded-2', status: QueueStatus.PROCESSING }),
      );

      const reset = store.resetProcessingToPending('user-1');

      expect(reset).toBe(2);
      const pending = store.getPendingMutationsForUser('user-1');
      expect(pending.map(m => m.id)).toEqual(
        expect.arrayContaining(['stranded-1', 'stranded-2']),
      );
    });

    it('leaves other statuses and other users untouched', () => {
      store.addMutation(makeMutation({ id: 'pending-1' }));
      store.addMutation(
        makeMutation({ id: 'success-1', status: QueueStatus.SUCCESS }),
      );
      store.addMutation(
        makeMutation({ id: 'failed-1', status: QueueStatus.FAILED }),
      );
      store.addMutation(
        makeMutation({
          id: 'other-user',
          userId: 'user-2',
          status: QueueStatus.PROCESSING,
        }),
      );

      const reset = store.resetProcessingToPending('user-1');

      expect(reset).toBe(0);
      expect(store.getMutation('success-1')?.status).toBe(QueueStatus.SUCCESS);
      expect(store.getMutation('failed-1')?.status).toBe(QueueStatus.FAILED);
      expect(store.getMutation('other-user')?.status).toBe(
        QueueStatus.PROCESSING,
      );
    });

    it('persists the reset (survives cache invalidation)', () => {
      store.addMutation(
        makeMutation({ id: 'stranded-p', status: QueueStatus.PROCESSING }),
      );
      store.resetProcessingToPending('user-1');
      store.invalidateCache();

      expect(store.getMutation('stranded-p')?.status).toBe(QueueStatus.PENDING);
    });
  });

  // -------------------------------------------------------------------------
  // getPendingClientIds
  // -------------------------------------------------------------------------
  describe('getPendingClientIds', () => {
    it('collects input.id and input.itemId from the current user pending queue', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({ id: 'm1', variables: { input: { id: 'cuid-create' } } }),
      );
      store.addMutation(
        makeMutation({
          id: 'm2',
          operationName: 'MoveShoppingListItem',
          variables: { input: { itemId: 'cuid-move' } },
        }),
      );

      const ids = store.getPendingClientIds();
      expect(ids).toEqual(new Set(['cuid-create', 'cuid-move']));
    });

    it('returns an empty set when no current user is set', () => {
      store.addMutation(
        makeMutation({ variables: { input: { id: 'cuid-x' } } }),
      );
      expect(store.getPendingClientIds().size).toBe(0);
    });

    it('ignores mutations with no resolvable client id', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(makeMutation({ id: 'no-id', variables: {} }));
      expect(store.getPendingClientIds().size).toBe(0);
    });

    it('collects a top-level variables.id', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({ id: 'm-top', variables: { id: 'cuid-top-level' } }),
      );
      expect(store.getPendingClientIds()).toEqual(new Set(['cuid-top-level']));
    });

    it('collects the item id from a single-item batch add', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({
          id: 'm-batch-1',
          operationName: 'AddItemsToShoppingList',
          variables: {
            input: {
              shoppingListId: 'list-1',
              items: [{ id: 'cuid-batch-a' }],
            },
          },
        }),
      );
      expect(store.getPendingClientIds()).toEqual(new Set(['cuid-batch-a']));
    });

    it('collects every item id from a multi-item batch add, not just the first', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({
          id: 'm-batch-n',
          operationName: 'AddItemsToShoppingList',
          variables: {
            input: {
              shoppingListId: 'list-1',
              items: [
                { id: 'cuid-batch-1' },
                { id: 'cuid-batch-2' },
                { id: 'cuid-batch-3' },
              ],
            },
          },
        }),
      );
      expect(store.getPendingClientIds()).toEqual(
        new Set(['cuid-batch-1', 'cuid-batch-2', 'cuid-batch-3']),
      );
    });

    it('skips batch items with missing or non-string ids without throwing', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({
          id: 'm-batch-bad',
          operationName: 'AddItemsToShoppingList',
          variables: {
            input: {
              shoppingListId: 'list-1',
              items: [
                { id: 'cuid-good' },
                { name: 'no id at all' },
                { id: 42 },
                { id: '' },
                null,
              ],
            },
          },
        }),
      );
      expect(store.getPendingClientIds()).toEqual(new Set(['cuid-good']));
    });

    it('recovered PROCESSING entries regain pending-id protection', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({
          id: 'm-stranded',
          status: QueueStatus.PROCESSING,
          variables: { input: { id: 'cuid-stranded' } },
        }),
      );
      expect(store.getPendingClientIds().size).toBe(0);

      store.resetProcessingToPending('user-1');
      expect(store.getPendingClientIds()).toEqual(new Set(['cuid-stranded']));
    });

    it('collects both input.id and items[].id when a shape carries both', () => {
      store.setCurrentUserId('user-1');
      store.addMutation(
        makeMutation({
          id: 'm-both',
          variables: {
            input: { id: 'cuid-input', items: [{ id: 'cuid-item' }] },
          },
        }),
      );
      expect(store.getPendingClientIds()).toEqual(
        new Set(['cuid-input', 'cuid-item']),
      );
    });
  });

  // The server prunes idempotency-dedup rows after 90 days — replaying a
  // PENDING op past that horizon would double-apply instead of classifying
  // as IDEMPOTENT_REPLAY, so it must fail out of the queue instead.
  describe('expireStalePending', () => {
    const NINETY_ONE_DAYS_AGO = Date.now() - 91 * 24 * 60 * 60 * 1000;

    it('marks PENDING entries older than 90 days as FAILED and never replays them', () => {
      store.addMutation(
        makeMutation({ id: 'stale-1', createdAt: NINETY_ONE_DAYS_AGO }),
      );

      const expired = store.expireStalePending('user-1');

      expect(expired).toBe(1);
      expect(store.getPendingMutationsForUser('user-1')).toEqual([]);
      const failed = store.getMutation('stale-1');
      expect(failed?.status).toBe(QueueStatus.FAILED);
      expect(failed?.lastError?.code).toBe('OFFLINE_SYNC_WINDOW_EXPIRED');
      expect(failed?.lastError?.retryable).toBe(false);
    });

    it('leaves fresh PENDING entries untouched', () => {
      store.addMutation(makeMutation({ id: 'fresh-1' }));
      store.addMutation(
        makeMutation({
          id: 'week-old',
          createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
        }),
      );

      const expired = store.expireStalePending('user-1');

      expect(expired).toBe(0);
      expect(store.getPendingMutationsForUser('user-1')).toHaveLength(2);
    });

    it('only expires the target user and PENDING status', () => {
      store.addMutation(
        makeMutation({
          id: 'other-user',
          userId: 'user-2',
          createdAt: NINETY_ONE_DAYS_AGO,
        }),
      );
      store.addMutation(
        makeMutation({
          id: 'already-failed',
          status: QueueStatus.FAILED,
          createdAt: NINETY_ONE_DAYS_AGO,
        }),
      );

      const expired = store.expireStalePending('user-1');

      expect(expired).toBe(0);
      expect(store.getMutation('other-user')?.status).toBe(QueueStatus.PENDING);
      expect(store.getMutation('already-failed')?.lastError).toBeUndefined();
    });
  });
});
