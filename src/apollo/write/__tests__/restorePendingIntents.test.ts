import { InMemoryCache } from '@apollo/client';
import { Kind } from 'graphql';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { QueueStatus, type QueuedMutation } from '#/apollo/offlineQueue/types';
import { adjustBy, type WriteIntent } from '../writeIntent';
import { restorePendingIntents } from '../restorePendingIntents';

/**
 * The queue is durable before the cache is — `addMutation` writes MMKV
 * synchronously while cache persistence is debounced and paused behind any
 * pushed screen. These cover the window that opens between them: a restart
 * with the write queued but missing from the cache.
 */
const queued = (
  id: string,
  intent?: WriteIntent,
  status = QueueStatus.PENDING,
  legacy = false,
): QueuedMutation => ({
  id: `q-${id}`,
  userId: 'user-1',
  operationName: 'UpdatePantryItem',
  mutation: { kind: Kind.DOCUMENT, definitions: [] },
  variables: { input: { id } },
  status,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  retryCount: 0,
  maxRetries: 3,
  requiresAuth: true,
  // `intents` is what the queue writes now; `intent` is what entries persisted
  // before it carry, and the horizon is ninety days — both are live at once.
  ...(legacy ? { intent } : { intents: intent ? [intent] : undefined }),
});

const intentFor = (id: string, patch: WriteIntent['patch']): WriteIntent => ({
  target: { __typename: 'PantryItem', id },
  patch,
  inverse: {},
  convergence: 'absolute',
});

function seed(cache: InMemoryCache, id: string, fields: object) {
  cache.restore({
    [`PantryItem:${id}`]: { __typename: 'PantryItem', id, ...fields },
  });
}

/** A second entity beside whatever `seed` already wrote. */
function seed2(cache: InMemoryCache, id: string, fields: object) {
  cache.restore({
    ...cache.extract(),
    [`PantryItem:${id}`]: { __typename: 'PantryItem', id, ...fields },
  });
}

const read = (cache: InMemoryCache, id: string) =>
  cache.extract()[`PantryItem:${id}`] as Record<string, unknown>;

describe('restorePendingIntents', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
    queueStore.clearAllQueues();
  });

  it('re-applies a patch the cache lost', () => {
    seed(cache, 'item-1', { storageNotes: 'old' });
    queueStore.addMutation(
      queued('item-1', intentFor('item-1', { storageNotes: 'new' })),
    );

    expect(restorePendingIntents(cache)).toBe(1);
    expect(read(cache, 'item-1').storageNotes).toBe('new');
  });

  it('is a no-op when the cache already persisted the write', () => {
    // The common case: `flushPending` drained on background, so restoring
    // writes the same value back. Idempotence is what makes it safe to run
    // blind, because nothing can tell the two cases apart.
    seed(cache, 'item-1', { storageNotes: 'new' });
    queueStore.addMutation(
      queued('item-1', intentFor('item-1', { storageNotes: 'new' })),
    );

    restorePendingIntents(cache);

    expect(read(cache, 'item-1').storageNotes).toBe('new');
  });

  it('never re-applies a relative adjustment', () => {
    // Re-applying `adjustBy(-1)` over a cache that kept the change subtracts
    // twice. A stale count the replay is about to correct beats an invented one.
    seed(cache, 'item-1', { quantity: 4 });
    queueStore.addMutation(
      queued('item-1', intentFor('item-1', { quantity: adjustBy(-1) })),
    );

    restorePendingIntents(cache);

    expect(read(cache, 'item-1').quantity).toBe(4);
  });

  it('merges a nested patch instead of replacing the object', () => {
    seed(cache, 'item-1', {
      purchaseInfo: { __typename: 'PurchaseInfo', isPurchased: false, qty: 2 },
    });
    queueStore.addMutation(
      queued(
        'item-1',
        intentFor('item-1', { purchaseInfo: { isPurchased: true } }),
      ),
    );

    restorePendingIntents(cache);

    expect(read(cache, 'item-1').purchaseInfo).toEqual({
      __typename: 'PurchaseInfo',
      isPurchased: true,
      qty: 2,
    });
  });

  it('leaves an entity the cache never had alone', () => {
    // `cache.modify` ignores a field the entity lacks, so a lost row is not
    // resurrected as a fragment of itself. The replay still holds the write.
    queueStore.addMutation(
      queued('gone', intentFor('gone', { storageNotes: 'new' })),
    );

    restorePendingIntents(cache);

    expect(read(cache, 'gone')).toBeUndefined();
  });

  it('skips entries the queue is no longer going to replay', () => {
    seed(cache, 'item-1', { storageNotes: 'old' });
    queueStore.addMutation(
      queued(
        'item-1',
        intentFor('item-1', { storageNotes: 'new' }),
        QueueStatus.FAILED,
      ),
    );

    expect(restorePendingIntents(cache)).toBe(0);
    expect(read(cache, 'item-1').storageNotes).toBe('old');
  });

  it('skips an entry queued before intents existed', () => {
    queueStore.addMutation(queued('item-1'));
    expect(restorePendingIntents(cache)).toBe(0);
  });

  it('restores without a current user recorded on the queue', () => {
    // The condition that made this silently do nothing on a real device:
    // `CURRENT_USER_KEY` is written only when the user CHANGES, so a session
    // that has simply been signed in for a while has none — and scoping the
    // restore by it returned zero every time, for every write. Verified on an
    // Android release build: an offline adjust replayed correctly on reconnect
    // but showed the pre-write value until then.
    expect(queueStore.getCurrentUserId()).toBeNull();
    seed(cache, 'item-1', { quantity: 5 });
    queueStore.addMutation(
      queued('item-1', intentFor('item-1', { quantity: 42 })),
    );

    expect(restorePendingIntents(cache)).toBe(1);
    expect(read(cache, 'item-1').quantity).toBe(42);
  });

  it('restores every entity a batch write changed', () => {
    seed(cache, 'item-1', { quantity: 1 });
    seed2(cache, 'item-2', { quantity: 1 });
    const entry = queued('batch');
    entry.intents = [
      intentFor('item-1', { quantity: 7 }),
      intentFor('item-2', { quantity: 9 }),
    ];
    queueStore.addMutation(entry);

    expect(restorePendingIntents(cache)).toBe(2);
    expect(read(cache, 'item-1').quantity).toBe(7);
    expect(read(cache, 'item-2').quantity).toBe(9);
  });

  it('still reads an entry persisted before intents were a list', () => {
    seed(cache, 'item-1', { quantity: 1 });
    queueStore.addMutation(
      queued('item-1', intentFor('item-1', { quantity: 7 }), undefined, true),
    );

    expect(restorePendingIntents(cache)).toBe(1);
    expect(read(cache, 'item-1').quantity).toBe(7);
  });

  it('re-applies a REMOVAL the cache still holds', () => {
    // The defect this closes: a removal carries `patch: {}`, so it was skipped
    // — the persisted cache still had the row, and a delete made just before a
    // kill came BACK on screen, then vanished again when the queue drained.
    seed(cache, 'item-1', { quantity: 1 });
    const entry = queued('gone');
    entry.intents = [
      {
        target: { __typename: 'PantryItem', id: 'item-1' },
        lifecycle: 'remove',
        patch: {},
        inverse: {},
        convergence: 'absolute',
      },
    ];
    queueStore.addMutation(entry);

    expect(restorePendingIntents(cache)).toBe(1);
    expect(read(cache, 'item-1')).toBeUndefined();
  });

  it("leaves a CREATE alone — the entity is the builder's to write", () => {
    // Nothing is lost: the write is still queued. It is simply invisible until
    // it replays, because the intent records only the undo.
    const entry = queued('new');
    entry.intents = [
      {
        target: { __typename: 'PantryItem', id: 'new-1' },
        lifecycle: 'create',
        patch: {},
        inverse: {},
        convergence: 'absolute',
      },
    ];
    queueStore.addMutation(entry);

    expect(restorePendingIntents(cache)).toBe(0);
  });
});
