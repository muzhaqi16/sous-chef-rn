/**
 * The optimistic line's lifecycle: what is built, what is reverted, and the
 * reconcile that adopts the server id.
 */

import {
  adoptServerShoppingListItemId,
  buildAddItemsReconcileUpdate,
  createOptimisticShoppingListItem,
  revertOptimisticShoppingListItem,
} from '../items';
import { createMockCache, invokeFieldModifier } from './helpers/mockCache';
import type { MockedCache } from './helpers/mockCache';

describe('createOptimisticShoppingListItem', () => {
  it('bakes the passed client id straight into the entity (no temp- prefix)', () => {
    const entity = createOptimisticShoppingListItem('c-abc123', {
      shoppingListId: 'list-1',
      itemName: 'Milk',
    });
    expect(entity.id).toBe('c-abc123');
    expect(entity.__typename).toBe('ShoppingListItem');
  });

  it('defaults quantity to 1, optional fields to null, displayFormat to AUTO', () => {
    const entity = createOptimisticShoppingListItem('c-1', {
      shoppingListId: 'list-1',
      itemName: 'Bread',
    });
    expect(entity.quantity).toBe(1);
    expect(entity.quantityInput).toBeNull();
    expect(entity.unitName).toBeNull();
    expect(entity.category).toBeNull();
    expect(entity.notes).toBeNull();
    expect(entity.displayFormat).toBe('AUTO');
    expect(entity.sortOrder).toBe('');
    expect(entity.purchaseInfo).toEqual({
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
      movedToPantryAt: null,
    });
    expect(entity.item).toBeNull();
    expect(entity.unit).toBeNull();
  });

  it('uses provided optional fields', () => {
    const entity = createOptimisticShoppingListItem('c-2', {
      shoppingListId: 'list-1',
      itemName: 'Milk',
      quantity: 2,
      quantityInput: '2',
      unitName: 'gallon',
      category: 'Dairy',
    });
    expect(entity.quantity).toBe(2);
    expect(entity.quantityInput).toBe('2');
    expect(entity.unitName).toBe('gallon');
    expect(entity.category).toBe('Dairy');
  });

  it('builds item ref from itemId and unit ref from unitId', () => {
    const entity = createOptimisticShoppingListItem('c-3', {
      shoppingListId: 'list-1',
      itemName: 'Milk',
      itemId: 'item-456',
      unitId: 'unit-789',
    });
    expect(entity.item).toEqual({
      __typename: 'Item',
      id: 'item-456',
      imageUrl: null,
      images: [],
    });
    expect(entity.unit).toEqual({
      __typename: 'Unit',
      id: 'unit-789',
      name: '',
      symbol: '',
    });
  });
});

describe('adoptServerShoppingListItemId', () => {
  it('evicts the client cuid when the server returned a different id', () => {
    const cache = createMockCache();
    adoptServerShoppingListItemId(cache, 'server-id', 'client-cuid');
    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:client-cuid',
    });
  });

  it('is a no-op when the server echoed the same id (no merge)', () => {
    const cache = createMockCache();
    adoptServerShoppingListItemId(cache, 'same-id', 'same-id');
    expect(cache.evict).not.toHaveBeenCalled();
  });

  it('is a no-op when there is no client id', () => {
    const cache = createMockCache();
    adoptServerShoppingListItemId(cache, 'server-id', undefined);
    expect(cache.evict).not.toHaveBeenCalled();
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
      wrap: { message: 'Cache update failed:' },
    })(cache, successData, variables);
    expect(cache.modify).toHaveBeenCalled();
  });
});
