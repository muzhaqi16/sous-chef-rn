/**
 * The move-to-pantry helpers against the REAL cache, for their COUNTERS.
 *
 * The sibling suite hand-drives a mocked `cache.modify`, invoking one modifier
 * at a time — so it can assert what the connection modifier returns and cannot
 * see the counters beside it at all. That is the whole defect: an edge
 * operation guarded against re-running, with `±1` next to it that is not.
 *
 * Both helpers can legitimately run twice for one user action:
 *  - the remove runs eagerly before the mutation fires AND again in the
 *    mutation's update callback;
 *  - the restore runs from the queue's withdrawal AND from the call site's own
 *    revert.
 */
import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { removeItemFromShoppingListForMoveToPantry } from '../moveToPantry';
import { seedQuery } from '#/test-utils/apolloMockProvider';

const LIST_COUNTS = gql`
  fragment ListCounts on ShoppingList {
    __typename
    id
    totalItems
    completedItems
  }
`;

type Counts = { totalItems: number; completedItems: number };

const ITEMS_QUERY = gql`
  query SeedItems($listId: ID!, $isPurchased: Boolean) {
    shoppingList(id: $listId) {
      __typename
      id
      totalItems
      completedItems
      itemsConnection(filters: { isPurchased: $isPurchased }) {
        __typename
        totalCount
        edges {
          __typename
          cursor
          node {
            __typename
            id
            purchaseInfo {
              __typename
              isPurchased
            }
            shoppingList {
              __typename
              id
            }
          }
        }
      }
    }
  }
`;

function seed({ completedItems = 2 } = {}) {
  const cache = makeCache();
  seedQuery(cache, {
    query: ITEMS_QUERY,
    variables: { listId: 'sl-1', isPurchased: true },
    data: {
      shoppingList: {
        __typename: 'ShoppingList',
        id: 'sl-1',
        totalItems: 5,
        completedItems,
        itemsConnection: {
          __typename: 'ShoppingListItemConnection',
          totalCount: 1,
          edges: [
            {
              __typename: 'ShoppingListItemEdge',
              cursor: 'sli-1',
              node: {
                __typename: 'ShoppingListItem',
                id: 'sli-1',
                purchaseInfo: {
                  __typename: 'ShoppingListItemPurchaseInfo',
                  isPurchased: true,
                },
                shoppingList: { __typename: 'ShoppingList', id: 'sl-1' },
              },
            },
          ],
        },
      },
    },
  });
  return cache;
}

const counts = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment<Counts>({
    id: 'ShoppingList:sl-1',
    fragment: LIST_COUNTS,
  });

const edgeCount = (cache: ReturnType<typeof makeCache>) => {
  const read = cache.readQuery<{
    shoppingList: { itemsConnection: { edges: unknown[]; totalCount: number } };
  }>({
    query: ITEMS_QUERY,
    variables: { listId: 'sl-1', isPurchased: true },
  });
  return {
    edges: read?.shoppingList?.itemsConnection?.edges?.length ?? 0,
    totalCount: read?.shoppingList?.itemsConnection?.totalCount ?? 0,
  };
};

describe('removeItemFromShoppingListForMoveToPantry counters', () => {
  it('applies one removal when a layer and its commit both run it', () => {
    const cache = seed();

    // The layer's unlink, which keeps the entity.
    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true, {
      evictEntity: false,
    });
    // The commit, once the server confirms.
    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    // The edge was removed once, so the counters must reflect one removal.
    expect(counts(cache)).toMatchObject({ totalItems: 4, completedItems: 1 });
    expect(edgeCount(cache)).toEqual({ edges: 0, totalCount: 0 });
  });

  it('applies one removal for a single call', () => {
    const cache = seed();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    expect(counts(cache)).toMatchObject({ totalItems: 4, completedItems: 1 });
    expect(edgeCount(cache)).toEqual({ edges: 0, totalCount: 0 });
  });

  it('does not touch completedItems for an unpurchased row', () => {
    const cache = seed();
    // Seed the unpurchased variant too, so the row has a connection to leave.
    seedQuery(cache, {
      query: ITEMS_QUERY,
      variables: { listId: 'sl-1', isPurchased: false },
      data: {
        shoppingList: {
          __typename: 'ShoppingList',
          id: 'sl-1',
          totalItems: 5,
          completedItems: 2,
          itemsConnection: {
            __typename: 'ShoppingListItemConnection',
            totalCount: 1,
            edges: [
              {
                __typename: 'ShoppingListItemEdge',
                cursor: 'sli-2',
                node: {
                  __typename: 'ShoppingListItem',
                  id: 'sli-2',
                  purchaseInfo: {
                    __typename: 'ShoppingListItemPurchaseInfo',
                    isPurchased: false,
                  },
                  shoppingList: { __typename: 'ShoppingList', id: 'sl-1' },
                },
              },
            ],
          },
        },
      },
    });

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-2', false);

    // An unpurchased row was never counted as completed.
    expect(counts(cache)).toMatchObject({ totalItems: 4, completedItems: 2 });
  });

  it('leaves the counters alone for a row that is not in the list', () => {
    const cache = seed();

    removeItemFromShoppingListForMoveToPantry(
      cache,
      'sl-1',
      'sli-absent',
      true,
    );

    expect(counts(cache)).toMatchObject({ totalItems: 5, completedItems: 2 });
  });
});
