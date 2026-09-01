/**
 * The pantry answers "do I already stock this?" from its own cache.
 *
 * The server's duplicate key is `(pantryId, itemId)` among non-deleted rows, and
 * the list query already caches both halves — so the question does not need a
 * round trip. It must not need one: offline the server cannot answer, and on the
 * replay path its refusal arrives with the existing ids stripped in production.
 *
 * The seed query below declares the SAME key args as `GetPantry`. That is
 * load-bearing, not decoration: `itemsConnection` is keyed on `filters`/`orderBy`,
 * so the app stores it under `itemsConnection:{}` while an argument-free query
 * stores a bare `itemsConnection`. Seeding a shape the app never produces makes
 * every case below pass against a store that does not exist, and the reader then
 * matches nothing on a device — which is exactly what happened.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { findCachedPantryItemDuplicate } from '../pantryCacheReaders';

const PANTRY = gql`
  query SeedPantry(
    $id: ID!
    $itemsFirst: Int
    $itemsFilter: PantryItemFilters
    $itemsOrderBy: PantryItemOrderBy
  ) {
    pantry(id: $id) {
      __typename
      id
      itemsConnection(
        first: $itemsFirst
        filters: $itemsFilter
        orderBy: $itemsOrderBy
      ) {
        __typename
        totalCount
        edges {
          __typename
          cursor
          node {
            __typename
            id
            itemName
            quantity
            item {
              __typename
              id
            }
          }
        }
      }
    }
  }
`;

/** What `usePantryQuery` sends in client mode: a page size, and no filters. */
const CLIENT_MODE_VARIABLES = {
  itemsFirst: 100,
  itemsFilter: undefined,
  itemsOrderBy: undefined,
};

const edge = (
  id: string,
  itemName: string,
  catalogItemId: string | null,
  quantity = 1,
) => ({
  __typename: 'PantryItemEdge',
  cursor: id,
  node: {
    __typename: 'PantryItem',
    id,
    itemName,
    quantity,
    item: catalogItemId ? { __typename: 'Item', id: catalogItemId } : null,
  },
});

function seedWith(edges: ReturnType<typeof edge>[], pantryId = 'p-1') {
  const cache = makeCache();
  cache.writeQuery({
    query: PANTRY,
    variables: { ...CLIENT_MODE_VARIABLES, id: pantryId },
    data: {
      pantry: {
        __typename: 'Pantry',
        id: pantryId,
        itemsConnection: {
          __typename: 'PantryItemConnection',
          totalCount: edges.length,
          edges,
        },
      },
    },
  });
  return cache;
}

const seed = (pantryId = 'p-1') =>
  seedWith(
    [
      edge('pi-1', 'Chicken Broth', 'item-broth', 3),
      edge('pi-2', 'Tart Apples', 'item-apples', 1),
    ],
    pantryId,
  );

describe('findCachedPantryItemDuplicate', () => {
  it('reads the key a filtered-but-unfiltered connection actually stores', () => {
    // Pins the store key itself. A bare `itemsConnection` here would mean the
    // reader is resolving a key the app never writes.
    const pantry = seed().extract()['Pantry:p-1'];
    expect(Object.keys(pantry ?? {})).toContain('itemsConnection:{}');
  });

  it('finds the row stocking a catalog item', () => {
    expect(
      findCachedPantryItemDuplicate(seed(), 'p-1', { itemId: 'item-broth' }),
    ).toEqual({
      existingPantryItemId: 'pi-1',
      existingPantryItemIds: ['pi-1'],
      quantity: 3,
    });
  });

  it('returns null for a catalog item the pantry does not stock', () => {
    expect(
      findCachedPantryItemDuplicate(seed(), 'p-1', { itemId: 'item-milk' }),
    ).toBeNull();
  });

  it('falls back to the item name when the caller has no catalog id', () => {
    expect(
      findCachedPantryItemDuplicate(seed(), 'p-1', {
        itemName: '  tart APPLES ',
      }),
    ).toEqual({
      existingPantryItemId: 'pi-2',
      existingPantryItemIds: ['pi-2'],
      quantity: 1,
    });
  });

  it('prefers the catalog id over the name when both are given', () => {
    // The id is the server's actual key; a name that disagrees must not win.
    expect(
      findCachedPantryItemDuplicate(seed(), 'p-1', {
        itemId: 'item-broth',
        itemName: 'Tart Apples',
      }),
    ).toEqual({
      existingPantryItemId: 'pi-1',
      existingPantryItemIds: ['pi-1'],
      quantity: 3,
    });
  });

  it('does not match a row in a different pantry', () => {
    expect(
      findCachedPantryItemDuplicate(seed('p-1'), 'p-2', {
        itemId: 'item-broth',
      }),
    ).toBeNull();
  });

  it('returns null when the pantry has never been cached', () => {
    expect(
      findCachedPantryItemDuplicate(makeCache(), 'p-1', {
        itemId: 'item-broth',
      }),
    ).toBeNull();
  });

  it('returns null without a pantry id or anything to match on', () => {
    const cache = seed();
    expect(
      findCachedPantryItemDuplicate(cache, undefined, {
        itemId: 'item-broth',
      }),
    ).toBeNull();
    expect(
      findCachedPantryItemDuplicate(cache, 'p-1', { itemName: '   ' }),
    ).toBeNull();
  });

  it('ignores a row whose catalog item is not cached', () => {
    const cache = seedWith([edge('pi-9', 'Loose Item', null)]);

    expect(
      findCachedPantryItemDuplicate(cache, 'p-1', { itemId: 'item-broth' }),
    ).toBeNull();
    // The name still reaches it — that is the details form's only handle.
    expect(
      findCachedPantryItemDuplicate(cache, 'p-1', { itemName: 'loose item' }),
    ).toEqual({
      existingPantryItemId: 'pi-9',
      existingPantryItemIds: ['pi-9'],
      quantity: 1,
    });
  });
});
