import type { ApolloCache } from '@apollo/client';
import {
  removeFromShoppingListItemsConnection,
  clearAllPurchasedItemsFromCache,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  addNewItemToShoppingListCache,
  removeItemFromShoppingListForMoveToPantry,
  restoreItemToShoppingListAfterMoveToPantry,
  createOptimisticShoppingListItem,
  adoptServerShoppingListItemId,
  revertOptimisticShoppingListItem,
  buildAddItemsReconcileUpdate,
} from '../shoppingListCacheUpdaters';

// Also test the unexported clearAllUnpurchasedItemsFromCache indirectly
// by importing it directly
import { clearAllUnpurchasedItemsFromCache } from '../shoppingListCacheUpdaters';
import { logger } from '#/utils/environment';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mock Apollo cache exposing the methods the updaters touch as jest mocks. */
type MockedCache = ApolloCache & {
  modify: jest.Mock;
  evict: jest.Mock;
  gc: jest.Mock;
  identify: jest.Mock;
  readFragment: jest.Mock;
};

/** A cache ref or normalized object the field helpers read from. */
type MockRef = { __ref?: string; [key: string]: unknown };

/** Field-modifier helpers passed to each `cache.modify` field function. */
interface FieldHelpers {
  toReference: jest.Mock;
  readField: jest.Mock;
  storeFieldName: string;
}

function createMockCache(): MockedCache {
  return {
    modify: jest.fn(),
    evict: jest.fn(),
    gc: jest.fn(),
    identify: jest.fn(
      (obj: { __typename: string; id: string }) =>
        `${obj.__typename}:${obj.id}`,
    ),
    readFragment: jest.fn(),
  } as unknown as MockedCache;
}

/**
 * Given a mock cache whose `modify` was called, extract and invoke
 * a specific field function from the modify call.
 */
function invokeFieldModifier(
  mockCache: MockedCache,
  fieldName: string,
  existingValue: unknown,
  helpers: Partial<FieldHelpers>,
  callIndex = 0,
) {
  const modifyCall = mockCache.modify.mock.calls[callIndex];
  const fields = modifyCall[0].fields;
  if (!fields[fieldName]) return undefined;
  return fields[fieldName](existingValue, helpers);
}

function createFieldHelpers(
  overrides: Partial<FieldHelpers> = {},
): FieldHelpers {
  return {
    toReference: jest.fn((item?: { __typename: string; id: string }) =>
      item ? { __ref: `${item.__typename}:${item.id}` } : undefined,
    ),
    readField: jest.fn((fieldName: string, ref?: MockRef) => {
      if (!ref) return undefined;
      if (ref.__ref) {
        const parts = ref.__ref.split(':');
        if (fieldName === 'id') return parts[1];
      }
      return ref[fieldName];
    }),
    storeFieldName: overrides.storeFieldName ?? 'itemsConnection',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// removeFromShoppingListItemsConnection
// ---------------------------------------------------------------------------

describe('removeFromShoppingListItemsConnection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is a function created by createRemoveFromParentConnectionUpdater', () => {
    expect(typeof removeFromShoppingListItemsConnection).toBe('function');
  });

  it('modifies the ShoppingList parent entity', () => {
    const cache = createMockCache();

    removeFromShoppingListItemsConnection(cache, 'sl-1', 'sli-1');

    expect(cache.identify).toHaveBeenCalledWith({
      __typename: 'ShoppingList',
      id: 'sl-1',
    });
    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ShoppingList:sl-1' }),
    );
  });

  it('removes the edge with the matching item id from itemsConnection', () => {
    const cache = createMockCache();

    removeFromShoppingListItemsConnection(cache, 'sl-1', 'sli-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
        if (ref?.__ref === 'ShoppingListItem:sli-2') return 'sli-2';
      }
      return undefined;
    });

    const existing = {
      edges: [
        { node: { __ref: 'ShoppingListItem:sli-1' } },
        { node: { __ref: 'ShoppingListItem:sli-2' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('evicts and gc when evictItem is true', () => {
    const cache = createMockCache();

    removeFromShoppingListItemsConnection(cache, 'sl-1', 'sli-1', {
      evictItem: true,
    });

    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:sli-1',
    });
    expect(cache.gc).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// clearAllPurchasedItemsFromCache
// ---------------------------------------------------------------------------

describe('clearAllPurchasedItemsFromCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when parent entity is not found', () => {
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    clearAllPurchasedItemsFromCache(cache, 'sl-missing', ['sli-1']);

    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('clears edges and sets totalCount to 0 for purchased connection', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1', 'sli-2']);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    const existing = {
      edges: [
        { node: { __ref: 'ShoppingListItem:sli-1' } },
        { node: { __ref: 'ShoppingListItem:sli-2' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('does not clear unpurchased connection variant', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1']);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-3' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('resets completedItems to 0 for purchased clear', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1']);

    const modifyCall = cache.modify.mock.calls[0];
    const fields = modifyCall[0].fields;

    expect(fields.completedItems).toBeDefined();
    expect(fields.completedItems()).toBe(0);
  });

  it('decrements totalItems by the number of cleared items', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1', 'sli-2', 'sli-3']);

    const result = invokeFieldModifier(cache, 'totalItems', 10, {});

    expect(result).toBe(7);
  });

  it('clamps totalItems to 0', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1', 'sli-2']);

    const result = invokeFieldModifier(cache, 'totalItems', 1, {});

    expect(result).toBe(0);
  });

  it('evicts all cleared items from cache', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1', 'sli-2']);

    expect(cache.evict).toHaveBeenCalledTimes(2);
    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:sli-1',
    });
    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:sli-2',
    });
  });

  it('runs gc once after all evictions', () => {
    const cache = createMockCache();

    clearAllPurchasedItemsFromCache(cache, 'sl-1', ['sli-1', 'sli-2']);

    expect(cache.gc).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// clearAllUnpurchasedItemsFromCache
// ---------------------------------------------------------------------------

describe('clearAllUnpurchasedItemsFromCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears edges for unpurchased connection variant', () => {
    const cache = createMockCache();

    clearAllUnpurchasedItemsFromCache(cache, 'sl-1', ['sli-1']);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it('does not reset completedItems for unpurchased clear', () => {
    const cache = createMockCache();

    clearAllUnpurchasedItemsFromCache(cache, 'sl-1', ['sli-1']);

    const modifyCall = cache.modify.mock.calls[0];
    const fields = modifyCall[0].fields;

    // completedItems should not be defined for unpurchased clear
    expect(fields.completedItems).toBeUndefined();
  });

  it('does not clear purchased connection variant', () => {
    const cache = createMockCache();

    clearAllUnpurchasedItemsFromCache(cache, 'sl-1', ['sli-1']);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-2' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });
});

// ---------------------------------------------------------------------------
// moveShoppingListItemToPurchased
// ---------------------------------------------------------------------------

describe('moveShoppingListItemToPurchased', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when parent entity is not found', () => {
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    moveShoppingListItemToPurchased(cache, 'sl-missing', { id: 'sli-1' });

    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('removes item from unpurchased connection', () => {
    const cache = createMockCache();

    moveShoppingListItemToPurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
        if (ref?.__ref === 'ShoppingListItem:sli-2') return 'sli-2';
      }
      return undefined;
    });

    const existing = {
      edges: [
        { node: { __ref: 'ShoppingListItem:sli-1' } },
        { node: { __ref: 'ShoppingListItem:sli-2' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('adds item to purchased connection', () => {
    const cache = createMockCache();

    moveShoppingListItemToPurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockReturnValue('sli-other');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-other' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].__typename).toBe('ShoppingListItemEdge');
    expect(result.edges[0].cursor).toBe('sli-1');
    expect(result.totalCount).toBe(2);
  });

  it('does not add duplicate to purchased connection', () => {
    const cache = createMockCache();

    moveShoppingListItemToPurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockReturnValue('sli-1');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('increments completedItems', () => {
    const cache = createMockCache();

    moveShoppingListItemToPurchased(cache, 'sl-1', { id: 'sli-1' });

    const result = invokeFieldModifier(cache, 'completedItems', 3, {});

    expect(result).toBe(4);
  });

  it('returns existing for unfiltered connection variant', () => {
    const cache = createMockCache();

    moveShoppingListItemToPurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('returns existing when edges are missing', () => {
    const cache = createMockCache();

    moveShoppingListItemToPurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = { totalCount: 0 }; // no edges field
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });
});

// ---------------------------------------------------------------------------
// moveShoppingListItemToUnpurchased
// ---------------------------------------------------------------------------

describe('moveShoppingListItemToUnpurchased', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes item from purchased connection', () => {
    const cache = createMockCache();

    moveShoppingListItemToUnpurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
      }
      return undefined;
    });

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('adds item to unpurchased connection', () => {
    const cache = createMockCache();

    moveShoppingListItemToUnpurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-other');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-other' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].__typename).toBe('ShoppingListItemEdge');
    expect(result.edges[0].cursor).toBe('sli-1');
    expect(result.totalCount).toBe(2);
  });

  it('does not add duplicate to unpurchased connection', () => {
    const cache = createMockCache();

    moveShoppingListItemToUnpurchased(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-1');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('decrements completedItems', () => {
    const cache = createMockCache();

    moveShoppingListItemToUnpurchased(cache, 'sl-1', { id: 'sli-1' });

    const result = invokeFieldModifier(cache, 'completedItems', 3, {});

    expect(result).toBe(2);
  });

  it('clamps completedItems to 0', () => {
    const cache = createMockCache();

    moveShoppingListItemToUnpurchased(cache, 'sl-1', { id: 'sli-1' });

    const result = invokeFieldModifier(cache, 'completedItems', 0, {});

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// addNewItemToShoppingListCache
// ---------------------------------------------------------------------------

describe('addNewItemToShoppingListCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when parent entity is not found', () => {
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    addNewItemToShoppingListCache(cache, 'sl-missing', { id: 'sli-1' });

    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('adds item to unpurchased connection variant', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-new' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-existing');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-existing' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].__typename).toBe('ShoppingListItemEdge');
    expect(result.edges[0].cursor).toBe('sli-new');
    expect(result.totalCount).toBe(2);
  });

  it('adds item to unfiltered connection variant', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-new' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection',
    });
    helpers.readField.mockReturnValue('sli-other');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-other' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('removes previously purchased item from purchased connection', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-repurchased' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-repurchased')
          return 'sli-repurchased';
        if (ref?.__ref === 'ShoppingListItem:sli-other') return 'sli-other';
      }
      return undefined;
    });

    const existing = {
      edges: [
        { node: { __ref: 'ShoppingListItem:sli-repurchased' } },
        { node: { __ref: 'ShoppingListItem:sli-other' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('does not modify purchased connection if item is not present there', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-new' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockReturnValue('sli-other');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-other' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('does not add duplicate to unpurchased connection', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-1');

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('increments totalItems', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-1' });

    const result = invokeFieldModifier(cache, 'totalItems', 5, {});

    expect(result).toBe(6);
  });

  it('defaults totalItems to 0 when undefined', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-1' });

    const result = invokeFieldModifier(cache, 'totalItems', undefined, {});

    expect(result).toBe(1);
  });

  it('returns existing when edges are missing', () => {
    const cache = createMockCache();

    addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-1' });

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = { totalCount: 0 }; // no edges
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('does not throw when cache.modify throws', () => {
    const cache = createMockCache();
    cache.modify.mockImplementation(() => {
      throw new Error('cache error');
    });
    expect(() =>
      addNewItemToShoppingListCache(cache, 'sl-1', { id: 'sli-1' }),
    ).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to update cache for new shopping list item',
      ),
      expect.any(Error),
    );
  });
});

// ---------------------------------------------------------------------------
// The eager unlink and its withdrawal
// ---------------------------------------------------------------------------

describe('move-to-pantry unlink and restore', () => {
  beforeEach(jest.clearAllMocks);

  it('evicts the entity on the confirmed path', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    expect(cache.evict).toHaveBeenCalled();
  });

  it('keeps the entity when the removal is only eager', () => {
    // Offline the row is unlinked before the server has agreed. Evicting here
    // is what made a permanently-refused replay lose the item from BOTH lists:
    // the queue withdrew the PantryItem it created, and there was nothing left
    // to put back on the shopping side.
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false, {
      evictEntity: false,
    });

    expect(cache.modify).toHaveBeenCalled();
    expect(cache.evict).not.toHaveBeenCalled();
  });

  it('re-adds the edge and the counters on withdrawal', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue({
      id: 'sli-1',
      purchaseInfo: { isPurchased: false },
      shoppingList: { id: 'sl-1' },
    });

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-9');
    helpers.toReference.mockReturnValue({ __ref: 'ShoppingListItem:sli-1' });

    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      { edges: [{ node: { __ref: 'ShoppingListItem:sli-9' } }], totalCount: 1 },
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.totalCount).toBe(2);
  });

  it('restores into the variant the row actually belongs to', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue({
      id: 'sli-1',
      purchaseInfo: { isPurchased: true },
      shoppingList: { id: 'sl-1' },
    });

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = { edges: [], totalCount: 0 };

    expect(
      invokeFieldModifier(cache, 'itemsConnection', existing, helpers),
    ).toBe(existing);
  });

  it('is idempotent — a second withdrawal does not duplicate the row', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue({
      id: 'sli-1',
      purchaseInfo: { isPurchased: false },
      shoppingList: { id: 'sl-1' },
    });

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockReturnValue('sli-1');
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };

    expect(
      invokeFieldModifier(cache, 'itemsConnection', existing, helpers),
    ).toBe(existing);
  });

  it('does nothing when the entity is gone', () => {
    const cache = createMockCache();
    cache.readFragment.mockReturnValue(null);

    restoreItemToShoppingListAfterMoveToPantry(cache, 'sli-1');

    expect(cache.modify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// removeItemFromShoppingListForMoveToPantry
// ---------------------------------------------------------------------------

describe('removeItemFromShoppingListForMoveToPantry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing when parent entity is not found', () => {
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    removeItemFromShoppingListForMoveToPantry(
      cache,
      'sl-missing',
      'sli-1',
      true,
    );

    expect(cache.modify).not.toHaveBeenCalled();
  });

  it('removes edge and decrements totalCount on purchased variant when wasPurchased=true', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
        if (ref?.__ref === 'ShoppingListItem:sli-2') return 'sli-2';
      }
      return undefined;
    });

    const existing = {
      edges: [
        { node: { __ref: 'ShoppingListItem:sli-1' } },
        { node: { __ref: 'ShoppingListItem:sli-2' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('does NOT modify unpurchased variant when wasPurchased=true', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-3' } }],
      totalCount: 3,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('removes edge and decrements totalCount on unpurchased variant when wasPurchased=false', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":false}',
    });
    helpers.readField.mockImplementation((field: string, ref?: MockRef) => {
      if (field === 'id') {
        if (ref?.__ref === 'ShoppingListItem:sli-1') return 'sli-1';
      }
      return undefined;
    });

    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(0);
    expect(result.totalCount).toBe(0);
  });

  it('does NOT modify purchased variant when wasPurchased=false', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    const helpers = createFieldHelpers({
      storeFieldName: 'itemsConnection:{"isPurchased":true}',
    });
    const existing = {
      edges: [{ node: { __ref: 'ShoppingListItem:sli-2' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  /**
   * The counters moved OUT of this suite.
   *
   * They live in a second `cache.modify` that only runs when the edge was
   * actually removed — this helper is called twice for one online move, and
   * `edges.filter` is idempotent while `-1` is not. `createMockCache().modify`
   * is a `jest.fn` that never invokes a modifier, so nothing here can make that
   * condition true, and a counter assertion in this suite could only ever
   * answer "does the modifier subtract?", which was never in doubt. That is how
   * the double-decrement shipped under a green suite.
   *
   * `moveToPantryCounters.test.ts` covers them against the real cache, where
   * the two passes and their cumulative result are observable.
   */

  it('evicts item entity and calls gc', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    expect(cache.evict).toHaveBeenCalledWith({
      id: 'ShoppingListItem:sli-1',
    });
    expect(cache.gc).toHaveBeenCalledTimes(1);
  });

  it('does not throw when cache.modify throws', () => {
    const cache = createMockCache();
    cache.modify.mockImplementation(() => {
      throw new Error('cache error');
    });

    expect(() =>
      removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true),
    ).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to remove item from ShoppingList for move to pantry',
      ),
      expect.any(Error),
    );
  });
});

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

describe('writePurchaseInfo', () => {
  const { gql } = require('@apollo/client');
  const { makeCache } = require('#/apollo/cache');
  const { writePurchaseInfo } = require('../shoppingListCacheUpdaters');

  const RECORD = gql`
    fragment WritePurchaseInfoProbe on ShoppingListItem {
      id
      purchaseInfo {
        isPurchased
        movedToPantryAt
        purchasedQuantity
        purchasedPrice
      }
      updatedAt
    }
  `;

  function seed(overrides: Record<string, unknown> = {}) {
    const cache = makeCache();
    cache.writeFragment({
      id: 'ShoppingListItem:i1',
      fragment: RECORD,
      data: {
        __typename: 'ShoppingListItem',
        id: 'i1',
        updatedAt: '2026-01-01T00:00:00.000Z',
        purchaseInfo: {
          __typename: 'ShoppingListItemPurchaseInfo',
          isPurchased: true,
          movedToPantryAt: '2026-08-28T10:00:00.000Z',
          purchasedQuantity: 3,
          purchasedPrice: 2.5,
          ...overrides,
        },
      },
    });
    return cache;
  }

  const read = (cache: { readFragment: Function }) =>
    cache.readFragment({
      id: 'ShoppingListItem:i1',
      fragment: RECORD,
      returnPartialData: true,
    }) as {
      updatedAt: string;
      purchaseInfo: {
        isPurchased: boolean;
        movedToPantryAt: string | null;
        purchasedQuantity: number | null;
        purchasedPrice: number | null;
      };
    } | null;

  it('clears the stamp when the flag flips', () => {
    const cache = seed();
    writePurchaseInfo(cache, 'i1', { isPurchased: false });

    // The server clears the stamp on this transition; the local write matches.
    expect(read(cache)?.purchaseInfo.movedToPantryAt).toBeNull();
    expect(read(cache)?.purchaseInfo.isPurchased).toBe(false);
  });

  it('keeps the rest of the record when the flag flips', () => {
    const cache = seed();
    writePurchaseInfo(cache, 'i1', { isPurchased: false });

    // The amounts describe a purchase the server recorded. Only the stamp is
    // derived from the flag.
    expect(read(cache)?.purchaseInfo.purchasedQuantity).toBe(3);
    expect(read(cache)?.purchaseInfo.purchasedPrice).toBe(2.5);
  });

  it('preserves the stamp when the flag is unchanged', () => {
    const cache = seed();
    writePurchaseInfo(cache, 'i1', { isPurchased: true });

    expect(read(cache)?.purchaseInfo.movedToPantryAt).toBe(
      '2026-08-28T10:00:00.000Z',
    );
  });

  it('sets the stamp without touching the flag', () => {
    const cache = seed({ isPurchased: false, movedToPantryAt: null });
    writePurchaseInfo(cache, 'i1', {
      movedToPantryAt: '2026-08-29T00:00:00.000Z',
    });

    // A stamp-only write must not assert a flag it does not own — asserting
    // `true` over a cached `false` is what cleared the record.
    expect(read(cache)?.purchaseInfo.isPurchased).toBe(false);
    expect(read(cache)?.purchaseInfo.movedToPantryAt).toBe(
      '2026-08-29T00:00:00.000Z',
    );
    expect(read(cache)?.purchaseInfo.purchasedQuantity).toBe(3);
  });

  it('writes updatedAt only when asked', () => {
    const cache = seed();
    writePurchaseInfo(cache, 'i1', { isPurchased: false });
    expect(read(cache)?.updatedAt).toBe('2026-01-01T00:00:00.000Z');

    writePurchaseInfo(
      cache,
      'i1',
      { isPurchased: true },
      { updatedAt: '2026-08-29T12:00:00.000Z' },
    );
    expect(read(cache)?.updatedAt).toBe('2026-08-29T12:00:00.000Z');
  });

  it('does nothing for an entity the cache cannot identify', () => {
    const cache = makeCache();
    expect(() =>
      writePurchaseInfo(cache, '', { isPurchased: true }),
    ).not.toThrow();
  });
});
