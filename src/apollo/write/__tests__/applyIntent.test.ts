import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { applyIntent, revertIntent } from '../applyIntent';
import { ABSENT, adjustBy, type WriteIntentDraft } from '../writeIntent';

const ITEM = { __typename: 'ShoppingListItem', id: 'item-1' };

function seedItem(cache: ReturnType<typeof makeCache>, extra: object = {}) {
  cache.restore({
    'ShoppingListItem:item-1': {
      __typename: 'ShoppingListItem',
      id: 'item-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
      purchaseInfo: {
        __typename: 'ShoppingListItemPurchaseInfo',
        isPurchased: false,
        purchasedQuantity: 2,
      },
      ...extra,
    },
  });
}

const read = (cache: ReturnType<typeof makeCache>) =>
  cache.extract()['ShoppingListItem:item-1'] as Record<string, unknown>;

describe('applyIntent / revertIntent', () => {
  let cache: ReturnType<typeof makeCache>;
  beforeEach(() => {
    cache = makeCache();
    seedItem(cache);
  });

  it('applies a flat patch and captures what was there', () => {
    const draft: WriteIntentDraft = {
      target: ITEM,
      patch: { updatedAt: '2026-06-06T00:00:00.000Z' },
      convergence: 'absolute',
    };

    const intent = applyIntent(cache, draft);

    expect(read(cache).updatedAt).toBe('2026-06-06T00:00:00.000Z');
    expect(intent.inverse).toEqual({ updatedAt: '2026-01-01T00:00:00.000Z' });
  });

  it('round-trips: reverting restores the exact prior value', () => {
    const before = read(cache);
    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { updatedAt: 'changed' },
      convergence: 'absolute',
    });

    revertIntent(cache, intent);

    expect(read(cache)).toEqual(before);
  });

  it('shallow-merges a partial object patch and inverts only the keys it touched', () => {
    // The toggle patches one key of `purchaseInfo`; the rest of that object
    // must survive both the write and the revert.
    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { purchaseInfo: { isPurchased: true } },
      convergence: 'absolute',
    });

    expect(read(cache).purchaseInfo).toEqual({
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: true,
      purchasedQuantity: 2,
    });
    expect(intent.inverse).toEqual({ purchaseInfo: { isPurchased: false } });

    revertIntent(cache, intent);
    expect(read(cache).purchaseInfo).toEqual({
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
      purchasedQuantity: 2,
    });
  });

  it('reverting a field that did not exist removes it rather than nulling it', () => {
    // Writing `undefined` would delete the field on the way IN too, which is
    // why the sentinel is explicit rather than implied by undefined.
    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { notes: 'added offline' },
      convergence: 'absolute',
    });
    expect(intent.inverse).toEqual({ notes: ABSENT });
    expect(read(cache).notes).toBe('added offline');

    revertIntent(cache, intent);
    expect('notes' in read(cache)).toBe(false);
  });

  it('reverting a nested key that did not exist removes only that key', () => {
    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { purchaseInfo: { purchasedPrice: 4.5 } },
      convergence: 'absolute',
    });
    expect(intent.inverse).toEqual({
      purchaseInfo: { purchasedPrice: ABSENT },
    });

    revertIntent(cache, intent);
    const info = read(cache).purchaseInfo as Record<string, unknown>;
    expect('purchasedPrice' in info).toBe(false);
    expect(info.purchasedQuantity).toBe(2);
  });

  it('adjusts a counter relatively, and undoes it by the negation', () => {
    // Restoring a snapshot would discard a concurrent change to the same
    // counter — the reason parent stats cannot be absolute patches.
    cache.restore({
      ...cache.extract(),
      'ShoppingList:list-1': {
        __typename: 'ShoppingList',
        id: 'list-1',
        completedItems: 4,
      },
    });
    const LIST = { __typename: 'ShoppingList', id: 'list-1' };

    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { purchaseInfo: { isPurchased: true } },
      aggregates: [{ target: LIST, patch: { completedItems: adjustBy(1) } }],
      convergence: 'absolute',
    });

    const listAfter = () =>
      (cache.extract()['ShoppingList:list-1'] as Record<string, unknown>)
        .completedItems;
    expect(listAfter()).toBe(5);
    expect(intent.aggregateInverses).toEqual([
      { completedItems: adjustBy(-1) },
    ]);

    revertIntent(cache, intent);
    expect(listAfter()).toBe(4);
  });

  it('a counter revert does not clobber a concurrent change', () => {
    cache.restore({
      ...cache.extract(),
      'ShoppingList:list-1': {
        __typename: 'ShoppingList',
        id: 'list-1',
        completedItems: 4,
      },
    });
    const LIST = { __typename: 'ShoppingList', id: 'list-1' };
    const listValue = () =>
      (cache.extract()['ShoppingList:list-1'] as Record<string, unknown>)
        .completedItems;

    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { updatedAt: 'x' },
      aggregates: [{ target: LIST, patch: { completedItems: adjustBy(1) } }],
      convergence: 'absolute',
    });
    expect(listValue()).toBe(5);

    // Something else adds two — a collaborator's changes arriving, say.
    applyIntent(cache, {
      target: ITEM,
      patch: { updatedAt: 'y' },
      aggregates: [{ target: LIST, patch: { completedItems: adjustBy(2) } }],
      convergence: 'absolute',
    });
    expect(listValue()).toBe(7);

    revertIntent(cache, intent);
    // 7 - 1, not a snapshot restore back to 4.
    expect(listValue()).toBe(6);
  });

  it('never lets a counter go negative', () => {
    cache.restore({
      ...cache.extract(),
      'ShoppingList:list-1': {
        __typename: 'ShoppingList',
        id: 'list-1',
        completedItems: 0,
      },
    });
    applyIntent(cache, {
      target: ITEM,
      patch: { updatedAt: 'x' },
      aggregates: [
        {
          target: { __typename: 'ShoppingList', id: 'list-1' },
          patch: { completedItems: adjustBy(-1) },
        },
      ],
      convergence: 'absolute',
    });
    expect(
      (cache.extract()['ShoppingList:list-1'] as Record<string, unknown>)
        .completedItems,
    ).toBe(0);
  });

  it('is serializable — the whole point of the inverse being a value', () => {
    // It rides the queue entry into MMKV, so anything unserializable here is a
    // write that cannot be undone after a restart.
    const intent = applyIntent(cache, {
      target: ITEM,
      patch: { purchaseInfo: { isPurchased: true }, updatedAt: 'x' },
      convergence: 'relative',
    });

    expect(JSON.parse(JSON.stringify(intent))).toEqual(intent);
  });

  it('undoes only its own change when a later write touched the same entity', () => {
    // The withdrawal must not clobber an edit made after it.
    const first = applyIntent(cache, {
      target: ITEM,
      patch: { purchaseInfo: { isPurchased: true } },
      convergence: 'absolute',
    });
    applyIntent(cache, {
      target: ITEM,
      patch: { updatedAt: 'later-edit' },
      convergence: 'absolute',
    });

    revertIntent(cache, first);

    const after = read(cache);
    expect((after.purchaseInfo as Record<string, unknown>).isPurchased).toBe(
      false,
    );
    expect(after.updatedAt).toBe('later-edit');
  });
});

describe('lifecycle: create and remove', () => {
  const LIST = { __typename: 'ShoppingList', id: 'list-1' };
  const NEW_ITEM = { __typename: 'ShoppingListItem', id: 'new-1' };

  const seedList = () => {
    const cache = makeCache();
    cache.restore({
      // A ROOT_QUERY reference, because production always has one: a removal
      // gc's the cache, and gc collects everything unreachable from a root.
      // Without this the parent list is swept as a side effect and the test
      // would be measuring its own unrealistic seeding.
      ROOT_QUERY: {
        __typename: 'Query',
        'shoppingList({"id":"list-1"})': { __ref: 'ShoppingList:list-1' },
      },
      'ShoppingListItem:item-1': {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        itemName: 'Oats',
        updatedAt: '2026-01-01T00:00:00.000Z',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: false,
        },
      },
      'ShoppingList:list-1': {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: 1,
        'itemsConnection({"isPurchased":false})': {
          __typename: 'ShoppingListItemConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'ShoppingListItemEdge',
              node: { __ref: 'ShoppingListItem:item-1' },
            },
          ],
        },
      },
    });
    return cache;
  };

  interface CachedConnection {
    totalCount: number;
    edges: { node: { __ref: string } }[];
  }

  const listVariant = (cache: ReturnType<typeof makeCache>): CachedConnection =>
    (
      cache.extract()['ShoppingList:list-1'] as Record<string, CachedConnection>
    )['itemsConnection({"isPurchased":false})'];

  const listTotal = (cache: ReturnType<typeof makeCache>): number =>
    (cache.extract()['ShoppingList:list-1'] as Record<string, number>)
      .totalItems;

  it('a removal is undoable OFFLINE, from the snapshot alone', () => {
    // The reason a delete could not be an evict: a withdrawal can land while
    // still offline, and no read can bring the row back. The snapshot is taken
    // before the write, so the undo needs nothing from the network.
    const cache = seedList();

    const intent = applyIntent(cache, {
      target: { __typename: 'ShoppingListItem', id: 'item-1' },
      lifecycle: 'remove',
      patch: {},
      aggregates: [{ target: LIST, patch: { totalItems: adjustBy(-1) } }],
      reindex: {
        parent: LIST,
        field: 'itemsConnection',
        decidableFilters: ['isPurchased'],
        after: {},
        before: { isPurchased: false },
      },
      convergence: 'absolute',
    });

    expect(cache.extract()['ShoppingListItem:item-1']).toBeUndefined();
    expect(listVariant(cache).edges).toEqual([]);
    expect(listTotal(cache)).toBe(0);

    revertIntent(cache, intent);

    const restored = cache.extract()['ShoppingListItem:item-1'] as Record<
      string,
      unknown
    >;
    expect(restored).toBeDefined();
    expect(restored.itemName).toBe('Oats');
    expect(listVariant(cache).edges).toHaveLength(1);
    expect(listTotal(cache)).toBe(1);
  });

  it('the snapshot is serializable, so the undo survives a restart', () => {
    const cache = seedList();
    const intent = applyIntent(cache, {
      target: { __typename: 'ShoppingListItem', id: 'item-1' },
      lifecycle: 'remove',
      patch: {},
      convergence: 'absolute',
    });

    // It rides the queue entry into MMKV with everything else.
    expect(JSON.parse(JSON.stringify(intent))).toEqual(intent);
    expect(intent.snapshot?.itemName).toBe('Oats');
  });

  it('a create writes the entity and undoes to its absence', () => {
    const cache = seedList();

    const intent = applyIntent(cache, {
      target: NEW_ITEM,
      lifecycle: 'create',
      // The feature's own builder supplies a COMPLETE entity; the kit writes it.
      patch: {
        __typename: 'ShoppingListItem',
        id: 'new-1',
        itemName: 'Rice',
        updatedAt: '2026-06-06T00:00:00.000Z',
      },
      aggregates: [{ target: LIST, patch: { totalItems: adjustBy(1) } }],
      reindex: {
        parent: LIST,
        field: 'itemsConnection',
        decidableFilters: ['isPurchased'],
        after: { isPurchased: false },
        before: {},
      },
      convergence: 'absolute',
    });

    expect(
      (cache.extract()['ShoppingListItem:new-1'] as Record<string, unknown>)
        ?.itemName,
    ).toBe('Rice');
    expect(listVariant(cache).edges).toHaveLength(2);
    expect(listTotal(cache)).toBe(2);

    revertIntent(cache, intent);

    expect(cache.extract()['ShoppingListItem:new-1']).toBeUndefined();
    expect(listVariant(cache).edges).toHaveLength(1);
    expect(listTotal(cache)).toBe(1);
  });

  it('restores a row whose children the gc swept, with no dangling refs', () => {
    // Removing the row makes its `Unit` and catalog `Item` unreachable, so the
    // gc takes them too. Restoring only the row put back `__ref`s pointing at
    // nothing: the read comes back incomplete and the row is invisible —
    // exactly what the snapshot exists to prevent, and unfixable offline.
    const cache = makeCache();
    cache.restore({
      ROOT_QUERY: {
        __typename: 'Query',
        'shoppingList({"id":"list-1"})': { __ref: 'ShoppingList:list-1' },
      },
      'Unit:u1': { __typename: 'Unit', id: 'u1', name: 'each', symbol: 'ea' },
      'ShoppingListItem:item-1': {
        __typename: 'ShoppingListItem',
        id: 'item-1',
        itemName: 'Oats',
        unit: { __ref: 'Unit:u1' },
      },
      'ShoppingList:list-1': { __typename: 'ShoppingList', id: 'list-1' },
    });

    const intent = applyIntent(cache, {
      target: { __typename: 'ShoppingListItem', id: 'item-1' },
      lifecycle: 'remove',
      patch: {},
      convergence: 'absolute',
    });

    // The gc took the child with the row.
    expect(cache.extract()['Unit:u1']).toBeUndefined();

    revertIntent(cache, intent);

    const row = cache.extract()['ShoppingListItem:item-1'] as Record<
      string,
      unknown
    >;
    expect(row?.itemName).toBe('Oats');
    // The ref resolves again, so the row actually reads.
    expect(cache.extract()['Unit:u1']).toBeDefined();
    expect((cache.extract()['Unit:u1'] as Record<string, unknown>).symbol).toBe(
      'ea',
    );
  });

  it('a removal leaves no orphan behind', () => {
    // `cache.ts` names item deletion as one of only two collection points and
    // states there is no periodic sweep, so an evict without a gc leaves an
    // entity that extract() writes to disk and every launch restores.
    const cache = seedList();
    applyIntent(cache, {
      target: { __typename: 'ShoppingListItem', id: 'item-1' },
      lifecycle: 'remove',
      patch: {},
      convergence: 'absolute',
    });

    expect(Object.keys(cache.extract())).not.toContain(
      'ShoppingListItem:item-1',
    );
  });
});

describe('reverting twice', () => {
  it('is a no-op, so a double withdrawal cannot drift a counter', () => {
    // The queue's capacity path withdraws once in `queueLink` when the enqueue
    // is refused and again through the failure handler, from the same intent.
    // A relative aggregate would move twice.
    const cache = makeCache();
    cache.restore({
      'ShoppingListItem:item-1': {
        __typename: 'ShoppingListItem',
        id: 'item-1',
      },
      'ShoppingList:list-1': {
        __typename: 'ShoppingList',
        id: 'list-1',
        completedItems: 4,
      },
    });
    const readCompleted = () =>
      (cache.extract()['ShoppingList:list-1'] as Record<string, number>)
        .completedItems;

    const intent = applyIntent(cache, {
      target: { __typename: 'ShoppingListItem', id: 'item-1' },
      patch: { updatedAt: 'x' },
      aggregates: [
        {
          target: { __typename: 'ShoppingList', id: 'list-1' },
          patch: { completedItems: adjustBy(1) },
        },
      ],
      convergence: 'absolute',
    });
    expect(readCompleted()).toBe(5);

    revertIntent(cache, intent);
    expect(readCompleted()).toBe(4);

    revertIntent(cache, intent);
    expect(readCompleted()).toBe(4);
  });
});

describe('the queued version refresh reads a REAL cache', () => {
  // The version-conflict re-send is the fix for the worst defect in the queue —
  // a single device editing one row twice offline losing the second edit. It
  // was dead: the fragment was declared `on Node`, and this schema has no
  // `Node` interface, so the read matched nothing and every conflict fell
  // through to withdrawal.
  //
  // It passed its own test because that test stubbed `readFragment` to hand
  // back a version the real cache would never have produced — the exact trap
  // the project documents. This drives `makeCache()` instead, so the fragment
  // has to actually match a type.
  it('a fragment on a type the schema lacks reads back no version', () => {
    const cache = makeCache();
    cache.restore({
      'PantryItem:p1': { __typename: 'PantryItem', id: 'p1', version: 7 },
    });

    const onMissingType = cache.readFragment<{ version?: number }>({
      id: 'PantryItem:p1',
      fragment: gql`
        fragment BadVersion on Node {
          version
        }
      `,
    });

    expect(onMissingType?.version).toBeUndefined();
  });

  it('a fragment on the real typename reads the version', () => {
    const cache = makeCache();
    cache.restore({
      'PantryItem:p1': { __typename: 'PantryItem', id: 'p1', version: 7 },
    });

    const onRealType = cache.readFragment<{ version?: number }>({
      id: 'PantryItem:p1',
      fragment: gql`
        fragment GoodVersion on PantryItem {
          version
        }
      `,
    });

    expect(onRealType?.version).toBe(7);
  });

  describe('withdrawing a removal', () => {
    const variantKey = (filters: Record<string, unknown>) =>
      `itemsConnection:${JSON.stringify({ filters })}`;

    const seedRemovable = () => {
      const cache = makeCache();
      cache.restore({
        'ShoppingListItem:item-1': {
          __typename: 'ShoppingListItem',
          id: 'item-1',
          itemName: 'Milk',
          // An ARGUMENT-BEARING field, which is the case that mattered: a
          // snapshot's keys are store field names, and a synthesized fragment
          // carrying one is a syntax error.
          'purchasesConnection({"first":10})': {
            __typename: 'PurchaseConnection',
            edges: [],
          },
        },
        'ShoppingList:list-1': {
          __typename: 'ShoppingList',
          id: 'list-1',
          [variantKey({ isPurchased: false })]: {
            __typename: 'ShoppingListItemConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'ShoppingListItemEdge',
                cursor: 'item-1',
                node: { __ref: 'ShoppingListItem:item-1' },
              },
            ],
          },
        },
      });
      cache.retain('ShoppingList:list-1');
      return cache;
    };

    const removal = {
      target: { __typename: 'ShoppingListItem', id: 'item-1' },
      lifecycle: 'remove' as const,
      patch: {},
      reindex: {
        parent: { __typename: 'ShoppingList', id: 'list-1' },
        field: 'itemsConnection',
        decidableFilters: ['isPurchased'],
        after: {},
        // Where it WAS. A removal needs no membership statement to leave; it
        // needs one to come back.
        before: { isPurchased: false },
      },
      convergence: 'absolute' as const,
    };

    const connectionOf = (cache: ReturnType<typeof makeCache>) =>
      (
        cache.extract()['ShoppingList:list-1'] as Record<
          string,
          { totalCount: number; edges: unknown[] }
        >
      )[variantKey({ isPurchased: false })];

    it('puts the row back WITH its argument-bearing fields', () => {
      const cache = seedRemovable();
      const intent = applyIntent(cache, removal);
      expect(cache.extract()['ShoppingListItem:item-1']).toBeUndefined();

      revertIntent(cache, intent);

      const restored = cache.extract()['ShoppingListItem:item-1'] as Record<
        string,
        unknown
      >;
      expect(restored).toBeDefined();
      expect(restored.itemName).toBe('Milk');
      // The field that made the fragment unparseable. Without it the row reads
      // incomplete, which offline means it does not render at all.
      expect(restored['purchasesConnection({"first":10})']).toBeDefined();
    });

    it('puts the row back into the list it came from', () => {
      // It used to come back into the cache and into NO list — present,
      // correct, and invisible, with nothing offline able to heal it.
      const cache = seedRemovable();
      const intent = applyIntent(cache, removal);
      expect(connectionOf(cache).edges).toHaveLength(0);

      revertIntent(cache, intent);

      expect(connectionOf(cache).edges).toHaveLength(1);
      expect(connectionOf(cache).totalCount).toBe(1);
    });

    it('leaves the rest of the store alone', () => {
      // `cache.restore` REPLACES the store, so the restore has to re-supply
      // what was already there. Writing the snapshot straight through it wiped
      // every other entity.
      const cache = seedRemovable();
      const intent = applyIntent(cache, removal);

      revertIntent(cache, intent);

      expect(cache.extract()['ShoppingList:list-1']).toBeDefined();
    });
  });
});
