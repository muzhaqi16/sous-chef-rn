import {
  removeFromShoppingListItemsConnection,
  clearAllPurchasedItemsFromCache,
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  addNewItemToShoppingListCache,
  removeItemFromShoppingListForMoveToPantry,
} from '../shoppingListCacheUpdaters';

// Also test the unexported clearAllUnpurchasedItemsFromCache indirectly
// by importing it directly
import { clearAllUnpurchasedItemsFromCache } from '../shoppingListCacheUpdaters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockCache() {
  return {
    modify: jest.fn(),
    evict: jest.fn(),
    gc: jest.fn(),
    identify: jest.fn(
      (obj: { __typename: string; id: string }) =>
        `${obj.__typename}:${obj.id}`,
    ),
  } as any;
}

/**
 * Given a mock cache whose `modify` was called, extract and invoke
 * a specific field function from the modify call.
 */
function invokeFieldModifier(
  mockCache: any,
  fieldName: string,
  existingValue: any,
  helpers: any,
  callIndex = 0,
) {
  const modifyCall = mockCache.modify.mock.calls[callIndex];
  const fields = modifyCall[0].fields;
  if (!fields[fieldName]) return undefined;
  return fields[fieldName](existingValue, helpers);
}

function createFieldHelpers(overrides: Record<string, any> = {}) {
  return {
    toReference: jest.fn((item: any) =>
      item ? { __ref: `${item.__typename}:${item.id}` } : undefined,
    ),
    readField: jest.fn((fieldName: string, ref: any) => {
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
    helpers.readField.mockImplementation((field: string, ref: any) => {
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
    helpers.readField.mockImplementation((field: string, ref: any) => {
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
    helpers.readField.mockImplementation((field: string, ref: any) => {
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
    helpers.readField.mockImplementation((field: string, ref: any) => {
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

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to update cache for new shopping list item',
      ),
      expect.any(Error),
    );
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
    helpers.readField.mockImplementation((field: string, ref: any) => {
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
    helpers.readField.mockImplementation((field: string, ref: any) => {
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

  it('decrements completedItems when wasPurchased=true', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const result = invokeFieldModifier(cache, 'completedItems', 3, {});

    expect(result).toBe(2);
  });

  it('does NOT have completedItems modifier when wasPurchased=false', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', false);

    const modifyCall = cache.modify.mock.calls[0];
    const fields = modifyCall[0].fields;

    expect(fields.completedItems).toBeUndefined();
  });

  it('decrements totalItems', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const result = invokeFieldModifier(cache, 'totalItems', 5, {});

    expect(result).toBe(4);
  });

  it('clamps totalItems to 0', () => {
    const cache = createMockCache();

    removeItemFromShoppingListForMoveToPantry(cache, 'sl-1', 'sli-1', true);

    const result = invokeFieldModifier(cache, 'totalItems', 0, {});

    expect(result).toBe(0);
  });

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

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to remove item from ShoppingList for move to pantry',
      ),
      expect.any(Error),
    );
  });
});
