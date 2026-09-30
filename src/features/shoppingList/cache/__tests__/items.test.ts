/**
 * The optimistic line's lifecycle: what is built, what is reverted, and the
 * reconcile that adopts the server id.
 */

import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import {
  reconcileShoppingItemCreateUpdate,
  buildAddItemsReconcileUpdate,
  addLocalShoppingListItem,
  createLocalShoppingListItem,
  revertOptimisticShoppingListItem,
} from '../items';
import { Items_RowFragmentDoc } from '../items.generated';
import { createMockCache, invokeFieldModifier } from './helpers/mockCache';
import type { MockedCache } from './helpers/mockCache';

describe('addLocalShoppingListItem: the row', () => {
  const writeLine = (
    cache: ReturnType<typeof makeCache>,
    fields: Parameters<typeof createLocalShoppingListItem>[1],
  ) => {
    addLocalShoppingListItem(
      cache,
      fields.shoppingListId,
      createLocalShoppingListItem('c-1', fields),
    );
    return cache.readFragment({
      id: 'ShoppingListItem:c-1',
      fragment: Items_RowFragmentDoc,
      fragmentName: 'items_row',
    });
  };

  it('writes a complete row under the client id, with neutral defaults', () => {
    const line = writeLine(makeCache(), {
      shoppingListId: 'list-1',
      itemName: 'Bread',
    });

    expect(line).toMatchObject({
      __typename: 'ShoppingListItem',
      id: 'c-1',
      quantity: 1,
      quantityInput: null,
      unitName: null,
      category: null,
      notes: null,
      displayFormat: 'AUTO',
      item: null,
      unit: null,
    });
    expect(line?.purchaseInfo.isPurchased).toBe(false);
  });

  it('uses the fields the create states', () => {
    const line = writeLine(makeCache(), {
      shoppingListId: 'list-1',
      itemName: 'Milk',
      quantity: 2,
      quantityInput: '2',
      unitName: 'gallon',
      category: 'Dairy',
    });

    expect(line).toMatchObject({
      quantity: 2,
      quantityInput: '2',
      unitName: 'gallon',
      category: 'Dairy',
    });
  });

  it('keeps the unit and catalog item the cache holds', () => {
    const cache = makeCache();
    cache.writeFragment({
      fragment: gql`
        fragment HeldUnit on Unit {
          id
          name
          symbol
        }
      `,
      data: { __typename: 'Unit', id: 'unit-g', name: 'gram', symbol: 'g' },
    });
    cache.writeFragment({
      fragment: gql`
        fragment HeldItem on Item {
          id
          imageUrl
        }
      `,
      data: {
        __typename: 'Item',
        id: 'item-milk',
        imageUrl: 'https://cdn.example.com/milk.jpg',
      },
    });

    const line = writeLine(cache, {
      shoppingListId: 'list-1',
      itemName: 'Milk',
      itemId: 'item-milk',
      unitId: 'unit-g',
    });

    expect(line?.unit).toMatchObject({ id: 'unit-g', symbol: 'g' });
    expect(line?.item).toMatchObject({
      id: 'item-milk',
      imageUrl: 'https://cdn.example.com/milk.jpg',
    });
  });
});

describe('revertOptimisticShoppingListItem', () => {
  function createCacheWithStats(stats: {
    totalItems: number;
    completedItems: number;
  }): MockedCache {
    return {
      ...createMockCache(),
      readFragment: jest.fn(() => stats),
    } as MockedCache & { readFragment: jest.Mock };
  }

  it('evicts the entity and decrements the list stat scalars', () => {
    const cache = createCacheWithStats({ totalItems: 5, completedItems: 2 });
    revertOptimisticShoppingListItem(cache, 'list-1', 'cuid-1');

    // entity evicted (a bare safeEvict would stop here, leaving stats inflated)
    expect(cache.evict).toHaveBeenCalledWith({ id: 'ShoppingListItem:cuid-1' });

    // and the parent scalars are reversed (mirror of the optimistic add bump)
    expect(invokeFieldModifier(cache, 'totalItems', 5, {})).toBe(4);
    expect(invokeFieldModifier(cache, 'remainingItems', 3, {})).toBe(2); // 4 - 2
    expect(invokeFieldModifier(cache, 'completionRate', 0.4, {})).toBe(0.5); // 2 / 4
  });

  it('floors totalItems at 0 and yields completionRate 0 on an empty list', () => {
    const cache = createCacheWithStats({ totalItems: 0, completedItems: 0 });
    revertOptimisticShoppingListItem(cache, 'list-1', 'cuid-1');
    expect(invokeFieldModifier(cache, 'totalItems', 0, {})).toBe(0);
    expect(invokeFieldModifier(cache, 'completionRate', 0, {})).toBe(0);
  });

  // Without a partial read, a list missing either stat reads as null, and the
  // fallback wrote a total of zero over a list of any size.
  it('leaves the total alone when the cache does not hold it', () => {
    const cache = {
      ...createMockCache(),
      readFragment: jest.fn(() => ({ completedItems: 2 })),
    } as MockedCache & { readFragment: jest.Mock };

    revertOptimisticShoppingListItem(cache, 'list-1', 'cuid-1');

    expect(cache.evict).toHaveBeenCalled();
    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('adjusts only the total when the completed count is missing', () => {
    const cache = {
      ...createMockCache(),
      readFragment: jest.fn(() => ({ totalItems: 5 })),
    } as MockedCache & { readFragment: jest.Mock };

    revertOptimisticShoppingListItem(cache, 'list-1', 'cuid-1');

    expect(invokeFieldModifier(cache, 'totalItems', 5, {})).toBe(4);
    const fields = (cache.modify as jest.Mock).mock.calls[0]?.[0]?.fields ?? {};
    expect(Object.keys(fields)).toEqual(['totalItems']);
  });

  it('leaves the counters alone when the response already settled them', () => {
    const cache = createCacheWithStats({ totalItems: 5, completedItems: 2 });

    revertOptimisticShoppingListItem(cache, 'list-1', 'cuid-1', {
      countsSettled: true,
    });

    expect(cache.evict).toHaveBeenCalled();
    expect(cache.modify).not.toHaveBeenCalled();
  });
});

describe('reconcileShoppingItemCreateUpdate', () => {
  function createCacheWithStats(stats: {
    totalItems: number;
    completedItems: number;
  }): MockedCache {
    return {
      ...createMockCache(),
      readFragment: jest.fn(() => stats),
    } as MockedCache & { readFragment: jest.Mock };
  }

  // The barcode add reaches here too. Evicting the folded-away row without
  // taking its count back leaves `totalItems` one high permanently: nothing on
  // the screen reads the count back, so only a full refetch can correct it.
  it('takes the count back with the row the server folded away', () => {
    const cache = createCacheWithStats({ totalItems: 5, completedItems: 2 });

    reconcileShoppingItemCreateUpdate(
      cache,
      'list-1',
      { id: 'server-id' },
      'client-cuid',
    );

    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:client-cuid',
    });
    expect(invokeFieldModifier(cache, 'totalItems', 5, {})).toBe(4);
  });

  it('leaves the count alone when the server kept the optimistic id', () => {
    const cache = createCacheWithStats({ totalItems: 5, completedItems: 2 });

    reconcileShoppingItemCreateUpdate(
      cache,
      'list-1',
      { id: 'same-id' },
      'same-id',
    );

    expect(cache.evict).not.toHaveBeenCalled();
  });

  it('is a no-op on the eviction path when there is no client id', () => {
    const cache = createCacheWithStats({ totalItems: 5, completedItems: 2 });

    reconcileShoppingItemCreateUpdate(
      cache,
      'list-1',
      { id: 'server-id' },
      undefined,
    );

    expect(cache.evict).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// buildAddItemsReconcileUpdate
// ---------------------------------------------------------------------------

describe('buildAddItemsReconcileUpdate', () => {
  const successData = {
    data: {
      addItemsToShoppingList: {
        __typename: 'AddItemsToShoppingListPayload',
        results: [{ item: { id: 'sli-server' } }],
      },
    },
  };
  const variables = {
    variables: { input: { items: [{ id: 'sli-client' }] } },
  };

  it('reconciles the created item into the closure-provided list', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({ listId: 'sl-closure' })(
      cache,
      successData,
      variables,
    );
    expect(cache.modify).toHaveBeenCalled();
    expect(cache.identify).toHaveBeenCalledWith({
      __typename: 'ShoppingList',
      id: 'sl-closure',
    });
  });

  it('falls back to variables.input.shoppingListId when no listId is given', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({})(cache, successData, {
      variables: {
        input: {
          items: [{ id: 'sli-client' }],
          shoppingListId: 'sl-from-vars',
        },
      },
    });
    expect(cache.identify).toHaveBeenCalledWith({
      __typename: 'ShoppingList',
      id: 'sl-from-vars',
    });
  });

  it('is a no-op for a non-success payload typename', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({ listId: 'sl-closure' })(
      cache,
      { data: { addItemsToShoppingList: { __typename: 'ValidationError' } } },
      variables,
    );
    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('is a no-op when the payload has no result item', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({ listId: 'sl-closure' })(
      cache,
      {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [],
          },
        },
      },
      variables,
    );
    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('is a no-op when no list id can be resolved', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({})(cache, successData, {
      variables: { input: { items: [{ id: 'sli-client' }] } },
    });
    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('still reconciles when the reconcile is wrapped for failure reporting', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({
      listId: 'sl-closure',
      wrap: { operation: 'Cache update failed:' },
    })(cache, successData, variables);
    expect(cache.modify).toHaveBeenCalled();
  });

  it('reconciles EVERY result, not only the first', () => {
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({ listId: 'sl-closure' })(
      cache,
      {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [
              { index: 0, item: { id: 'sli-a' } },
              { index: 1, item: { id: 'sli-b' } },
            ],
          },
        },
      },
      { variables: { input: { items: [{ id: 'sli-a' }, { id: 'sli-b' }] } } },
    );
    expect(cache.modify).toHaveBeenCalledTimes(2);
  });

  it('pairs each result back to its OWN minted id by index', () => {
    // Index, not array position: a partially-failed batch answers out of step
    // with the input, and withdrawing the wrong row loses a line the user added.
    const cache = createMockCache();
    buildAddItemsReconcileUpdate({ listId: 'sl-closure' })(
      cache,
      {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [{ index: 1, item: { id: 'sli-server' } }],
          },
        },
      },
      { variables: { input: { items: [{ id: 'sli-a' }, { id: 'sli-b' }] } } },
    );
    expect(cache.evict).toHaveBeenCalledWith({ id: 'ShoppingListItem:sli-b' });
  });

  it('takes the optimistic count back when the server merged the line', () => {
    const cache = {
      ...createMockCache(),
      readFragment: jest.fn(() => ({ totalItems: 5, completedItems: 2 })),
    } as MockedCache;
    buildAddItemsReconcileUpdate({ listId: 'sl-closure' })(
      cache,
      {
        data: {
          addItemsToShoppingList: {
            __typename: 'AddItemsToShoppingListPayload',
            results: [{ index: 0, item: { id: 'sli-existing' } }],
          },
        },
      },
      variables,
    );
    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:sli-client',
    });
    expect(invokeFieldModifier(cache, 'totalItems', 5, {})).toBe(4);
  });
});
