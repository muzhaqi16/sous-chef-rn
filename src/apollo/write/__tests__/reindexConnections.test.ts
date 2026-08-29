import { makeCache } from '#/apollo/cache';
import { ROOT_PARENT } from '../writeIntent';
import { reindexConnections } from '../reindexConnections';
import type { ReindexSpec } from '../writeIntent';

const ITEM = { __typename: 'ShoppingListItem', id: 'item-1' };
const LIST = { __typename: 'ShoppingList', id: 'list-1' };

const SPEC: ReindexSpec = {
  parent: LIST,
  field: 'itemsConnection',
  decidableFilters: ['isPurchased'],
  after: { isPurchased: true },
  before: { isPurchased: false },
};

const conn = (ids: string[], total = ids.length) => ({
  __typename: 'ShoppingListItemConnection',
  totalCount: total,
  edges: ids.map(id => ({
    __typename: 'ShoppingListItemEdge',
    node: { __ref: `ShoppingListItem:${id}` },
  })),
});

/**
 * Store field names as InMemoryCache ACTUALLY emits them.
 *
 * The suite originally hand-typed `itemsConnection({"isPurchased":false})`.
 * With a `keyArgs` policy the cache emits
 * `itemsConnection:{"filters":{"isPurchased":false}}` instead — so every seed
 * parsed as "no arguments", every variant decided `include`, and the whole
 * file was green against a branch production never reaches. Verified against
 * `makeCache()` + `writeQuery`.
 */
const variantKey = (filters: Record<string, unknown>) =>
  `itemsConnection:${JSON.stringify({ filters })}`;

function seed(variants: Record<string, unknown>) {
  const cache = makeCache();
  cache.restore({
    'ShoppingListItem:item-1': { __typename: 'ShoppingListItem', id: 'item-1' },
    'ShoppingListItem:other': { __typename: 'ShoppingListItem', id: 'other' },
    'ShoppingList:list-1': {
      __typename: 'ShoppingList',
      id: 'list-1',
      ...variants,
    },
  });
  return cache;
}

interface CachedConnection {
  totalCount: number;
  edges: { node: { __ref: string } }[];
}

const variantOf = (
  cache: ReturnType<typeof makeCache>,
  key: string,
): CachedConnection =>
  (cache.extract()['ShoppingList:list-1'] as Record<string, CachedConnection>)[
    key
  ];

describe('reindexConnections', () => {
  it('moves the entity between two decidable variants and follows the counts', () => {
    const cache = seed({
      [variantKey({ isPurchased: false })]: conn(['item-1', 'other']),
      [variantKey({ isPurchased: true })]: conn([]),
    });

    reindexConnections(cache, ITEM, SPEC);

    const from = variantOf(cache, variantKey({ isPurchased: false }));
    const to = variantOf(cache, variantKey({ isPurchased: true }));
    expect(from.edges.map(e => e.node.__ref)).toEqual([
      'ShoppingListItem:other',
    ]);
    expect(from.totalCount).toBe(1);
    expect(to.edges.map(e => e.node.__ref)).toEqual([
      'ShoppingListItem:item-1',
    ]);
    expect(to.totalCount).toBe(1);
  });

  it('LEAVES ALONE a variant filtered on something it cannot decide', () => {
    // The fail-closed rule. A row briefly missing from a cached list heals on
    // that list's next read; a row wrongly inserted into one does not.
    const cache = seed({
      [variantKey({ isPurchased: true, category: 'Dairy' })]: conn([]),
    });

    reindexConnections(cache, ITEM, SPEC);

    expect(
      variantOf(cache, variantKey({ isPurchased: true, category: 'Dairy' }))
        .edges,
    ).toEqual([]);
  });

  it('leaves alone a variant whose arguments cannot be parsed', () => {
    const cache = seed({ ['itemsConnection:not-json']: conn([]) });
    reindexConnections(cache, ITEM, SPEC);
    expect(variantOf(cache, 'itemsConnection:not-json').edges).toEqual([]);
  });

  it('ignores pagination arguments when deciding', () => {
    // `first` is part of the store field name but says nothing about
    // membership; treated as a filter it would make every real variant skip.
    const cache = seed({
      ['itemsConnection:{"first":20,"filters":{"isPurchased":true}}']: conn([]),
    });

    reindexConnections(cache, ITEM, SPEC);

    expect(
      variantOf(
        cache,
        'itemsConnection:{"first":20,"filters":{"isPurchased":true}}',
      ).edges,
    ).toHaveLength(1);
  });

  it('is idempotent — re-running does not double-insert or over-decrement', () => {
    const cache = seed({
      [variantKey({ isPurchased: false })]: conn(['item-1']),
      [variantKey({ isPurchased: true })]: conn([]),
    });

    reindexConnections(cache, ITEM, SPEC);
    reindexConnections(cache, ITEM, SPEC);

    expect(
      variantOf(cache, variantKey({ isPurchased: true })).edges,
    ).toHaveLength(1);
    expect(variantOf(cache, variantKey({ isPurchased: true })).totalCount).toBe(
      1,
    );
    expect(
      variantOf(cache, variantKey({ isPurchased: false })).totalCount,
    ).toBe(0);
  });

  it('inverts cleanly — swapping before/after returns the entity', () => {
    const cache = seed({
      [variantKey({ isPurchased: false })]: conn(['item-1']),
      [variantKey({ isPurchased: true })]: conn([]),
    });

    reindexConnections(cache, ITEM, SPEC);
    reindexConnections(cache, ITEM, {
      ...SPEC,
      after: SPEC.before,
      before: SPEC.after,
    });

    expect(
      variantOf(cache, variantKey({ isPurchased: false })).edges.map(
        e => e.node.__ref,
      ),
    ).toEqual(['ShoppingListItem:item-1']);
    expect(variantOf(cache, variantKey({ isPurchased: true })).edges).toEqual(
      [],
    );
  });

  it('treats an unfiltered variant as containing everything', () => {
    // Correct for a MOVE: the row still exists, so it still belongs to the
    // unfiltered list.
    const cache = seed({ itemsConnection: conn(['other']) });
    reindexConnections(cache, ITEM, SPEC);
    expect(variantOf(cache, 'itemsConnection').edges).toHaveLength(2);
  });

  it('removes from an unfiltered variant, which a filter match could never express', () => {
    // This used to be impossible. `matches()` is `active.every(...)`, which is
    // vacuously TRUE when a variant declares no filters — so spelling a
    // removal as `after: {}` read as "belongs everywhere" and ADDED the row.
    // A removal is not a statement about filters, so it no longer makes one:
    // `lifecycle: 'remove'` leaves every variant unconditionally.
    const cache = seed({ itemsConnection: conn(['item-1', 'other']) });

    reindexConnections(cache, ITEM, SPEC, 'remove');

    expect(
      variantOf(cache, 'itemsConnection').edges.map(e => e.node.__ref),
    ).toEqual(['ShoppingListItem:other']);
  });

  it('a removal also leaves a variant it could not decide membership for', () => {
    // Fail-closed for a MOVE means "leave it alone"; for a removal it means
    // "take it out" — staying in a variant is a row on screen that is gone.
    const cache = seed({
      [variantKey({ isPurchased: true, category: 'Dairy' })]: conn(['item-1']),
    });

    reindexConnections(cache, ITEM, SPEC, 'remove');

    expect(
      variantOf(cache, variantKey({ isPurchased: true, category: 'Dairy' }))
        .edges,
    ).toEqual([]);
  });

  it('a create joins only the variants it matches, and leaves none', () => {
    const cache = seed({
      [variantKey({ isPurchased: true })]: conn([]),
      [variantKey({ isPurchased: false })]: conn(['other']),
    });

    reindexConnections(cache, ITEM, SPEC, 'create');

    expect(
      variantOf(cache, variantKey({ isPurchased: true })).edges,
    ).toHaveLength(1);
    // `before` is meaningless for a create — nothing is removed from anywhere.
    expect(
      variantOf(cache, variantKey({ isPurchased: false })).edges.map(
        e => e.node.__ref,
      ),
    ).toEqual(['ShoppingListItem:other']);
  });

  describe('a ROOT-QUERY connection', () => {
    // A top-level collection like `Query.shoppingLists` has nowhere else to be
    // indexed. Before the root could be named as a parent, a create's undo
    // evicted the entity and left its edge dangling in the overview.
    const rootKey = `shoppingLists:${JSON.stringify({
      filters: { homeId: 'home-1' },
    })}`;

    const seedRoot = () => {
      const cache = makeCache();
      cache.restore({
        'ShoppingList:list-1': { __typename: 'ShoppingList', id: 'list-1' },
        ROOT_QUERY: {
          __typename: 'Query',
          [rootKey]: {
            __typename: 'ShoppingListConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'ShoppingListEdge',
                cursor: 'list-1',
                node: { __ref: 'ShoppingList:list-1' },
              },
            ],
          },
        },
      });
      return cache;
    };

    const rootConnection = (cache: ReturnType<typeof makeCache>) =>
      (cache.extract().ROOT_QUERY as Record<string, CachedConnection>)[rootKey];

    it('takes a removed row out of the root connection', () => {
      const cache = seedRoot();

      reindexConnections(
        cache,
        { __typename: 'ShoppingList', id: 'list-1' },
        {
          parent: ROOT_PARENT,
          field: 'shoppingLists',
          decidableFilters: [],
          after: {},
          before: {},
        },
        'remove',
      );

      expect(rootConnection(cache).edges).toHaveLength(0);
      expect(rootConnection(cache).totalCount).toBe(0);
    });

    it('leaves the root connection alone for a create', () => {
      // The feature's own builder inserts a create; the spec exists so the UNDO
      // can take it back out.
      const cache = seedRoot();

      reindexConnections(
        cache,
        { __typename: 'ShoppingList', id: 'list-2' },
        {
          parent: ROOT_PARENT,
          field: 'shoppingLists',
          decidableFilters: [],
          after: {},
          before: {},
        },
        'create',
      );

      expect(rootConnection(cache).edges).toHaveLength(1);
    });
  });
});
