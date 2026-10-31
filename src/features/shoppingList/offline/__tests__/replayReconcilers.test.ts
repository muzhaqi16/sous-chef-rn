/**
 * What a shopping replay moves when the server answers with another row, and
 * what a list reads once a delete's answer has named its row.
 */

import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { removeFromShoppingListItemsConnection } from '#features/shoppingList/cache/connections';
import {
  reconcileShoppingAddReplay,
  reconcileShoppingCreateReplay,
} from '../replayReconcilers';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

const LIST = gql`
  query ReplayReconcilersProbeList($id: ID!) {
    shoppingList(id: $id) {
      id
      totalItems
      completedItems
      remainingItems
      itemsConnection {
        totalCount
        edges {
          node {
            id
            itemName
            quantity
          }
        }
      }
    }
  }
`;

interface ListRead {
  shoppingList: {
    totalItems: number;
    remainingItems: number;
    itemsConnection: {
      edges: { node: { id: string; itemName: string; quantity: number } }[];
    };
  };
}

const row = (id: string, itemName: string, quantity: number) => ({
  __typename: 'ShoppingListItem',
  id,
  itemName,
  quantity,
});

/** A list holding `held`, with its counters to match. */
function seedList(held: ReturnType<typeof row>[]): InMemoryCache {
  const cache = makeCache();
  seedQuery(cache, {
    query: LIST,
    variables: { id: 'list-1' },
    data: {
      shoppingList: {
        __typename: 'ShoppingList',
        id: 'list-1',
        totalItems: held.length,
        completedItems: 0,
        remainingItems: held.length,
        itemsConnection: {
          __typename: 'ShoppingListItemConnection',
          totalCount: held.length,
          edges: held.map(node => ({
            __typename: 'ShoppingListItemEdge',
            node,
          })),
        },
      },
    },
  });
  return cache;
}

/** What the list reads, or null when the read is incomplete. */
function readList(cache: InMemoryCache) {
  const diff = cache.diff<ListRead>({
    query: LIST,
    variables: { id: 'list-1' },
    returnPartialData: false,
    optimistic: false,
  });
  if (!diff.complete || !diff.result) return null;
  const list = diff.result.shoppingList;
  return {
    total: list.totalItems,
    remaining: list.remainingItems,
    rows: list.itemsConnection.edges.map(({ node }) => [
      node.id,
      node.quantity,
    ]),
  };
}

const merged = (id: string, version?: number) => ({
  success: true,
  item: { id, version },
});

describe('a replayed batch add', () => {
  const adoptionsOf = (items: unknown[], results: unknown[]) => {
    const adopt = jest.fn();
    reconcileShoppingAddReplay(
      makeCache(),
      { input: { shoppingListId: 'list-1', items } },
      {
        addItemsToShoppingList: {
          __typename: 'AddItemsToShoppingListPayload',
          results,
        },
      },
      adopt,
    );
    return adopt.mock.calls.map(([adoption]: unknown[]) => adoption);
  };

  it('moves the writes behind a merged line onto the row the server kept', () => {
    expect(adoptionsOf([{ id: 'minted' }], [merged('held', 4)])).toEqual([
      { mintedId: 'minted', survivingId: 'held', version: 4 },
    ]);
  });

  it('moves nothing for a line the server kept under its minted id', () => {
    expect(adoptionsOf([{ id: 'minted' }], [merged('minted')])).toEqual([]);
  });

  it('moves nothing for a refused line', () => {
    expect(
      adoptionsOf(
        [{ id: 'minted-a' }, { id: 'minted-b' }],
        [
          { success: false, item: null },
          { success: false, item: { id: 'held' } },
        ],
      ),
    ).toEqual([]);
  });

  it('pairs a line by the index the server echoes, not its position', () => {
    expect(
      adoptionsOf(
        [{ id: 'minted-a' }, { id: 'minted-b' }],
        [{ ...merged('held', 2), index: 1 }],
      ),
    ).toEqual([{ mintedId: 'minted-b', survivingId: 'held', version: 2 }]);
  });
});

describe('a replayed create made with lines', () => {
  it('moves the writes behind a merged line', () => {
    const adopt = jest.fn();

    reconcileShoppingCreateReplay(
      makeCache(),
      { input: { id: 'list-1', items: [{ id: 'minted' }] } },
      {
        createShoppingList: {
          __typename: 'CreateShoppingListPayload',
          itemResults: [merged('held', 7)],
        },
      },
      adopt,
    );

    expect(adopt).toHaveBeenCalledWith({
      mintedId: 'minted',
      survivingId: 'held',
      version: 7,
    });
  });
});

describe('a delete whose answer names the deleted row', () => {
  /** The local removal the hook makes before the delete fires. */
  function removedLocally() {
    const cache = seedList([
      row('row-bread', 'Bread', 1),
      row('row-soap', 'Soap', 1),
    ]);
    removeFromShoppingListItemsConnection(cache, 'list-1', 'row-soap', {
      evictItem: true,
    });
    return cache;
  }
  const stub = (cache: InMemoryCache) =>
    seedFragment(cache, {
      fragment: gql`
        fragment ReplayReconcilersProbeStub on ShoppingListItem {
          id
        }
      `,
      data: { __typename: 'ShoppingListItem', id: 'row-soap' },
    });

  it('keeps the list readable, and the row gone, once the stub lands', () => {
    const cache = removedLocally();
    stub(cache);

    expect(readList(cache)?.rows).toEqual([['row-bread', 1]]);
  });
});
