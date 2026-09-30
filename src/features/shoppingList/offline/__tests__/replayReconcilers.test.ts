/**
 * The shopping replay reconcilers on a real cache: what a list reads after a
 * replay the server answered differently than the local write assumed.
 */

import { gql, type InMemoryCache } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  addLocalShoppingListItem,
  createLocalShoppingListItem,
} from '#features/shoppingList/cache/items';
import { removeFromShoppingListItemsConnection } from '#features/shoppingList/cache/connections';
import {
  reconcileShoppingAddReplay,
  reconcileShoppingRowReplay,
  settleShoppingItemDelete,
} from '../replayReconcilers';
import { withdrawAddedShoppingListItems } from '../queueWithdrawals';

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

const ROW = gql`
  fragment ReplayReconcilersProbeRow on ShoppingListItem {
    id
    itemName
    quantity
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
  cache.writeQuery({
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

/** A line added locally under `id`, counted as the add sites count it. */
function mint(cache: InMemoryCache, id: string, itemName: string) {
  addLocalShoppingListItem(
    cache,
    'list-1',
    createLocalShoppingListItem(id, {
      shoppingListId: 'list-1',
      itemName,
    }),
  );
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

/** Apollo writes the replay's result before the reconciler runs. */
const writeServerRow = (cache: InMemoryCache, value: ReturnType<typeof row>) =>
  cache.writeFragment({ fragment: ROW, data: value });

describe('a single row merged into an existing line', () => {
  const variables = {
    input: {
      shoppingListId: 'list-1',
      items: [{ id: 'minted-milk', item: { itemName: 'Milk' } }],
    },
  };
  const merged = row('held-milk', 'Milk', 3);
  const answer = (item: object) => ({
    addItemsToShoppingList: {
      __typename: 'AddItemsToShoppingListPayload',
      results: [{ index: 0, success: true, item }],
    },
  });
  const data = answer(merged);

  function replayed() {
    const cache = seedList([row('held-milk', 'Milk', 2)]);
    mint(cache, 'minted-milk', 'Milk');
    writeServerRow(cache, merged);
    return cache;
  }

  it('shows only the merged line, with the quantity the service states', () => {
    const cache = replayed();

    reconcileShoppingAddReplay(cache, variables, data);

    expect(readList(cache)).toEqual({
      total: 1,
      remaining: 1,
      rows: [['held-milk', 3]],
    });
  });

  it('equals a single application when it runs again', () => {
    const cache = replayed();
    reconcileShoppingAddReplay(cache, variables, data);
    const once = cache.extract();

    reconcileShoppingAddReplay(cache, variables, data);

    expect(cache.extract()).toEqual(once);
  });

  it('leaves a line the service created under the minted id', () => {
    const cache = seedList([]);
    mint(cache, 'minted-milk', 'Milk');

    reconcileShoppingAddReplay(
      cache,
      variables,
      answer(row('minted-milk', 'Milk', 1)),
    );

    expect(readList(cache)?.rows).toEqual([['minted-milk', 1]]);
  });
});

describe('a replayed batch the service accepted in part', () => {
  const variables = {
    input: {
      shoppingListId: 'list-1',
      items: [{ id: 'minted-a' }, { id: 'minted-b' }, { id: 'minted-c' }],
    },
  };
  const data = {
    addItemsToShoppingList: {
      __typename: 'AddItemsToShoppingListPayload',
      results: [
        { index: 0, success: true, item: { id: 'minted-a' } },
        { index: 1, success: false, item: null },
        { index: 2, success: true, item: { id: 'held-eggs' } },
      ],
    },
  };

  function replayed() {
    const cache = seedList([row('held-eggs', 'Eggs', 12)]);
    mint(cache, 'minted-a', 'Bread');
    mint(cache, 'minted-b', 'Soap');
    mint(cache, 'minted-c', 'Eggs');
    return cache;
  }

  it('withdraws the refused row, folds the merged one, keeps the rest', () => {
    const cache = replayed();

    reconcileShoppingAddReplay(cache, variables, data);

    expect(readList(cache)).toEqual({
      total: 2,
      remaining: 2,
      rows: expect.arrayContaining([
        ['minted-a', 1],
        ['held-eggs', 12],
      ]),
    });
    expect(readList(cache)?.rows).toHaveLength(2);
  });

  it('equals a single application when it runs again', () => {
    const cache = replayed();
    reconcileShoppingAddReplay(cache, variables, data);
    const once = cache.extract();

    reconcileShoppingAddReplay(cache, variables, data);

    expect(cache.extract()).toEqual(once);
  });
});

describe('a recipe ingredient line merged on replay', () => {
  it('folds the minted line into the one the service kept', () => {
    const cache = seedList([row('held-flour', 'Flour', 2)]);
    mint(cache, 'minted-flour', 'Flour');

    reconcileShoppingRowReplay(
      cache,
      { input: { id: 'minted-flour', shoppingListId: 'list-1' } },
      {
        createShoppingListItemFromRecipeIngredient: {
          __typename: 'CreateShoppingListItemFromRecipeIngredientPayload',
          shoppingListItem: { id: 'held-flour' },
        },
      },
    );

    expect(readList(cache)).toEqual({
      total: 1,
      remaining: 1,
      rows: [['held-flour', 2]],
    });
  });
});

describe('a refused batch withdrawn by the queue', () => {
  it('takes every minted row out, and its count, once', () => {
    const cache = seedList([row('held-eggs', 'Eggs', 12)]);
    mint(cache, 'minted-a', 'Bread');
    mint(cache, 'minted-b', 'Soap');
    const variables = {
      input: {
        shoppingListId: 'list-1',
        items: [{ id: 'minted-a' }, { id: 'minted-b' }],
      },
    };

    withdrawAddedShoppingListItems(cache, variables, 'minted-a');
    withdrawAddedShoppingListItems(cache, variables, 'minted-a');

    expect(readList(cache)).toEqual({
      total: 1,
      remaining: 1,
      rows: [['held-eggs', 12]],
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
    cache.writeFragment({
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

  it('takes the stub out again on a replay after an offline cold start', () => {
    const before = removedLocally();
    const cache = makeCache();
    cache.restore(before.extract());
    stub(cache);

    settleShoppingItemDelete(
      cache,
      { input: { id: 'row-soap' } },
      {
        removeItemFromShoppingList: {
          __typename: 'RemoveItemFromShoppingListPayload',
          converged: false,
          shoppingListItem: { id: 'row-soap' },
        },
      },
    );

    expect(readList(cache)?.rows).toEqual([['row-bread', 1]]);
    expect(cache.extract()).not.toHaveProperty('ShoppingListItem:row-soap');
  });
});
