import {
  createAddToQueryFieldUpdater,
  createAddToKeyedQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  createAddToParentConnectionUpdater,
  createAddToParentArrayUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromParentArrayUpdater,
  createItemEvictor,
} from '../cacheUpdaters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock Apollo cache with jest.fn() for all methods we use.
 * `modify` captures the fields object so we can invoke field functions
 * in assertions.
 */
function createMockCache() {
  return {
    modify: jest.fn(),
    evict: jest.fn(),
    gc: jest.fn(),
    identify: jest.fn(
      (obj: { __typename: string; id: string }) => `${obj.__typename}:${obj.id}`,
    ),
  } as any;
}

/** Standard field helpers reused across tests */
function createFieldHelpers(overrides: Record<string, any> = {}) {
  return {
    toReference: jest.fn((item: any) =>
      item ? { __ref: `${item.__typename}:${item.id}` } : undefined,
    ),
    readField: jest.fn((fieldName: string, ref: any) => {
      if (!ref) return undefined;
      // For refs created by our mock toReference, pull id from __ref
      if (ref.__ref) {
        const parts = ref.__ref.split(':');
        if (fieldName === 'id') return parts[1];
      }
      return ref[fieldName];
    }),
    storeFieldName: overrides.storeFieldName ?? 'fieldName',
    ...overrides,
  };
}

/**
 * Given a mock cache whose `modify` was called, extract and invoke the
 * specified field function with the given existing value and helpers.
 * Returns the value returned by the field function.
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
  return fields[fieldName](existingValue, helpers);
}

// ---------------------------------------------------------------------------
// createAddToQueryFieldUpdater
// ---------------------------------------------------------------------------

describe('createAddToQueryFieldUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a new item at the start by default', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    const newItem = { id: '1', __typename: 'Home', name: 'My Home' };

    addToHomes(cache, newItem);

    expect(cache.modify).toHaveBeenCalledTimes(1);

    const helpers = createFieldHelpers();
    const existingRefs = [{ __ref: 'Home:2' }];
    const result = invokeFieldModifier(cache, 'homes', existingRefs, helpers);

    expect(result[0]).toEqual(helpers.toReference.mock.results[0]?.value);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(existingRefs[0]);
  });

  it('adds a new item at the end when position is end', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    const newItem = { id: '1', __typename: 'Home', name: 'My Home' };

    addToHomes(cache, newItem, { position: 'end' });

    const helpers = createFieldHelpers();
    const existingRefs = [{ __ref: 'Home:2' }];
    const result = invokeFieldModifier(cache, 'homes', existingRefs, helpers);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existingRefs[0]);
  });

  it('prevents duplicates by default', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    const newItem = { id: '1', __typename: 'Home' };

    addToHomes(cache, newItem);

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, _ref: any) => {
      if (field === 'id') return '1';
      return undefined;
    });
    const existingRefs = [{ __ref: 'Home:1' }];
    const result = invokeFieldModifier(cache, 'homes', existingRefs, helpers);

    expect(result).toBe(existingRefs); // unchanged
  });

  it('allows duplicates when checkDuplicates is false', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    const newItem = { id: '1', __typename: 'Home' };

    addToHomes(cache, newItem, { checkDuplicates: false });

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string) => {
      if (field === 'id') return '1';
      return undefined;
    });
    const existingRefs = [{ __ref: 'Home:1' }];
    const result = invokeFieldModifier(cache, 'homes', existingRefs, helpers);

    expect(result).toHaveLength(2);
  });

  it('returns existing items when toReference returns undefined', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    const newItem = { id: '1', __typename: 'Home' };

    addToHomes(cache, newItem);

    const helpers = createFieldHelpers();
    helpers.toReference.mockReturnValue(undefined);
    const existingRefs = [{ __ref: 'Home:2' }];
    const result = invokeFieldModifier(cache, 'homes', existingRefs, helpers);

    expect(result).toBe(existingRefs);
  });

  it('defaults to empty array when existing items are undefined', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    const newItem = { id: '1', __typename: 'Home' };

    addToHomes(cache, newItem);

    const helpers = createFieldHelpers();
    const result = invokeFieldModifier(cache, 'homes', undefined, helpers);

    expect(result).toHaveLength(1);
  });

  it('does not throw when cache.modify throws', () => {
    const addToHomes = createAddToQueryFieldUpdater('homes');
    const cache = createMockCache();
    cache.modify.mockImplementation(() => {
      throw new Error('cache error');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(() => addToHomes(cache, { id: '1', __typename: 'Home' } as any)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache update failed for adding to homes'),
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// createAddToKeyedQueryFieldUpdater
// ---------------------------------------------------------------------------

describe('createAddToKeyedQueryFieldUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds item when storeFieldName matches the key value', () => {
    const addToItems = createAddToKeyedQueryFieldUpdater(
      'shoppingListItems',
      'shoppingListId',
    );
    const cache = createMockCache();
    const newItem = { id: 'item-1', __typename: 'ShoppingListItem' };

    addToItems(cache, newItem, 'list-abc');

    const helpers = createFieldHelpers({
      storeFieldName: 'shoppingListItems:{"shoppingListId":"list-abc"}',
    });
    const result = invokeFieldModifier(
      cache,
      'shoppingListItems',
      [],
      helpers,
    );

    expect(result).toHaveLength(1);
  });

  it('returns existing items when storeFieldName does not match', () => {
    const addToItems = createAddToKeyedQueryFieldUpdater(
      'shoppingListItems',
      'shoppingListId',
    );
    const cache = createMockCache();
    const newItem = { id: 'item-1', __typename: 'ShoppingListItem' };

    addToItems(cache, newItem, 'list-abc');

    const helpers = createFieldHelpers({
      storeFieldName: 'shoppingListItems:{"shoppingListId":"list-xyz"}',
    });
    const existing = [{ __ref: 'ShoppingListItem:other' }];
    const result = invokeFieldModifier(
      cache,
      'shoppingListItems',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('adds at end when position is end', () => {
    const addToItems = createAddToKeyedQueryFieldUpdater(
      'pantryItems',
      'pantryId',
    );
    const cache = createMockCache();

    addToItems(cache, { id: 'new', __typename: 'PantryItem' } as any, 'p-1', {
      position: 'end',
    });

    const helpers = createFieldHelpers({
      storeFieldName: 'pantryItems:{"pantryId":"p-1"}',
    });
    const existing = [{ __ref: 'PantryItem:old' }];
    const result = invokeFieldModifier(
      cache,
      'pantryItems',
      existing,
      helpers,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existing[0]);
  });

  it('prevents duplicates by default', () => {
    const addToItems = createAddToKeyedQueryFieldUpdater(
      'shoppingListItems',
      'shoppingListId',
    );
    const cache = createMockCache();

    addToItems(cache, { id: 'item-1', __typename: 'ShoppingListItem' } as any, 'list-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'shoppingListItems:{"shoppingListId":"list-1"}',
    });
    helpers.readField.mockImplementation((field: string) => {
      if (field === 'id') return 'item-1';
      return undefined;
    });

    const existing = [{ __ref: 'ShoppingListItem:item-1' }];
    const result = invokeFieldModifier(
      cache,
      'shoppingListItems',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('returns existing items when toReference returns undefined', () => {
    const addToItems = createAddToKeyedQueryFieldUpdater(
      'shoppingListItems',
      'shoppingListId',
    );
    const cache = createMockCache();

    addToItems(cache, { id: '1', __typename: 'Item' } as any, 'list-1');

    const helpers = createFieldHelpers({
      storeFieldName: 'shoppingListItems:{"shoppingListId":"list-1"}',
    });
    helpers.toReference.mockReturnValue(undefined);
    const existing = [{ __ref: 'Item:old' }];
    const result = invokeFieldModifier(
      cache,
      'shoppingListItems',
      existing,
      helpers,
    );

    expect(result).toBe(existing);
  });

  it('does not throw when cache.modify throws', () => {
    const addToItems = createAddToKeyedQueryFieldUpdater('items', 'listId');
    const cache = createMockCache();
    cache.modify.mockImplementation(() => {
      throw new Error('fail');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(() => addToItems(cache, { id: '1' }, 'list-1')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// createRemoveFromQueryFieldUpdater
// ---------------------------------------------------------------------------

describe('createRemoveFromQueryFieldUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters out the item with the given id', () => {
    const removeFromHomes = createRemoveFromQueryFieldUpdater('homes', 'Home');
    const cache = createMockCache();

    removeFromHomes(cache, 'home-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, ref: any) => {
      if (field === 'id') {
        if (ref.__ref === 'Home:home-1') return 'home-1';
        if (ref.__ref === 'Home:home-2') return 'home-2';
      }
      return undefined;
    });

    const existing = [{ __ref: 'Home:home-1' }, { __ref: 'Home:home-2' }];
    const result = invokeFieldModifier(cache, 'homes', existing, helpers);

    expect(result).toHaveLength(1);
    expect(result[0].__ref).toBe('Home:home-2');
  });

  it('does not evict or gc by default', () => {
    const removeFromHomes = createRemoveFromQueryFieldUpdater('homes', 'Home');
    const cache = createMockCache();

    removeFromHomes(cache, 'home-1');

    expect(cache.evict).not.toHaveBeenCalled();
    expect(cache.gc).not.toHaveBeenCalled();
  });

  it('evicts the item and runs gc when evictItem is true', () => {
    const removeFromHomes = createRemoveFromQueryFieldUpdater('homes', 'Home');
    const cache = createMockCache();

    removeFromHomes(cache, 'home-1', { evictItem: true });

    expect(cache.evict).toHaveBeenCalledWith({ id: 'Home:home-1' });
    expect(cache.gc).toHaveBeenCalled();
  });

  it('evicts the item but skips gc when gc is false', () => {
    const removeFromHomes = createRemoveFromQueryFieldUpdater('homes', 'Home');
    const cache = createMockCache();

    removeFromHomes(cache, 'home-1', { evictItem: true, gc: false });

    expect(cache.evict).toHaveBeenCalledWith({ id: 'Home:home-1' });
    expect(cache.gc).not.toHaveBeenCalled();
  });

  it('does not throw when cache.modify throws', () => {
    const removeFromHomes = createRemoveFromQueryFieldUpdater('homes', 'Home');
    const cache = createMockCache();
    cache.modify.mockImplementation(() => {
      throw new Error('fail');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(() => removeFromHomes(cache, 'home-1')).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// createAddToQueryConnectionUpdater
// ---------------------------------------------------------------------------

describe('createAddToQueryConnectionUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a new edge at the start by default', () => {
    const addToShoppingLists = createAddToQueryConnectionUpdater(
      'shoppingLists',
      'ShoppingList',
    );
    const cache = createMockCache();
    const newItem = { id: 'sl-1', __typename: 'ShoppingList', name: 'Groceries' };

    addToShoppingLists(cache, newItem);

    const helpers = createFieldHelpers();
    const existingConnection = {
      edges: [{ __typename: 'ShoppingListEdge', node: { __ref: 'ShoppingList:sl-2' }, cursor: 'c1' }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'shoppingLists',
      existingConnection,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].__typename).toBe('ShoppingListEdge');
    expect(result.edges[0].cursor).toBe('');
    expect(result.totalCount).toBe(2);
  });

  it('adds a new edge at the end when position is end', () => {
    const addToLists = createAddToQueryConnectionUpdater('lists', 'List');
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' } as any, { position: 'end' });

    const helpers = createFieldHelpers();
    const existingConnection = {
      edges: [{ node: { __ref: 'List:l-0' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'lists',
      existingConnection,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[1].__typename).toBe('ListEdge');
  });

  it('prevents duplicates by default', () => {
    const addToLists = createAddToQueryConnectionUpdater('lists', 'List');
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' } as any);

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, _ref: any) => {
      if (field === 'id') return 'l-1';
      return undefined;
    });
    const existingConnection = {
      edges: [{ node: { __ref: 'List:l-1' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'lists',
      existingConnection,
      helpers,
    );

    expect(result).toBe(existingConnection);
  });

  it('does not update totalCount when updateTotalCount is false', () => {
    const addToLists = createAddToQueryConnectionUpdater('lists', 'List');
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' } as any, { updateTotalCount: false });

    const helpers = createFieldHelpers();
    const existingConnection = { edges: [], totalCount: 5 };
    const result = invokeFieldModifier(
      cache,
      'lists',
      existingConnection,
      helpers,
    );

    expect(result.totalCount).toBe(5);
  });

  it('returns existing connection when toReference returns undefined', () => {
    const addToLists = createAddToQueryConnectionUpdater('lists', 'List');
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' } as any);

    const helpers = createFieldHelpers();
    helpers.toReference.mockReturnValue(undefined);
    const existingConnection = { edges: [], totalCount: 0 };
    const result = invokeFieldModifier(
      cache,
      'lists',
      existingConnection,
      helpers,
    );

    expect(result).toBe(existingConnection);
  });

  it('handles empty existing connection object', () => {
    const addToLists = createAddToQueryConnectionUpdater('lists', 'List');
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' } as any);

    const helpers = createFieldHelpers();
    const result = invokeFieldModifier(cache, 'lists', {}, helpers);

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// createRemoveFromQueryConnectionUpdater
// ---------------------------------------------------------------------------

describe('createRemoveFromQueryConnectionUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes the edge with the matching id', () => {
    const removeFromRecipes = createRemoveFromQueryConnectionUpdater(
      'recipes',
      'Recipe',
    );
    const cache = createMockCache();

    removeFromRecipes(cache, 'r-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, ref: any) => {
      if (field === 'id' && ref?.__ref === 'Recipe:r-1') return 'r-1';
      if (field === 'id' && ref?.__ref === 'Recipe:r-2') return 'r-2';
      return undefined;
    });

    const existingConnection = {
      edges: [
        { node: { __ref: 'Recipe:r-1' } },
        { node: { __ref: 'Recipe:r-2' } },
      ],
      totalCount: 2,
    };
    const result = invokeFieldModifier(
      cache,
      'recipes',
      existingConnection,
      helpers,
    );

    expect(result.edges).toHaveLength(1);
    expect(result.totalCount).toBe(1);
  });

  it('clamps totalCount to 0', () => {
    const remove = createRemoveFromQueryConnectionUpdater('items', 'Item');
    const cache = createMockCache();

    remove(cache, 'i-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockReturnValue('i-1');

    const existingConnection = {
      edges: [{ node: { __ref: 'Item:i-1' } }],
      totalCount: 0,
    };
    const result = invokeFieldModifier(
      cache,
      'items',
      existingConnection,
      helpers,
    );

    expect(result.totalCount).toBe(0);
  });

  it('evicts the item and runs gc when evictItem is true', () => {
    const remove = createRemoveFromQueryConnectionUpdater('recipes', 'Recipe');
    const cache = createMockCache();

    remove(cache, 'r-1', { evictItem: true });

    expect(cache.evict).toHaveBeenCalledWith({ id: 'Recipe:r-1' });
    expect(cache.gc).toHaveBeenCalled();
  });

  it('does not evict by default', () => {
    const remove = createRemoveFromQueryConnectionUpdater('recipes', 'Recipe');
    const cache = createMockCache();

    remove(cache, 'r-1');

    expect(cache.evict).not.toHaveBeenCalled();
    expect(cache.gc).not.toHaveBeenCalled();
  });

  it('skips gc when gc is false', () => {
    const remove = createRemoveFromQueryConnectionUpdater('recipes', 'Recipe');
    const cache = createMockCache();

    remove(cache, 'r-1', { evictItem: true, gc: false });

    expect(cache.evict).toHaveBeenCalled();
    expect(cache.gc).not.toHaveBeenCalled();
  });

  it('does not update totalCount when updateTotalCount is false', () => {
    const remove = createRemoveFromQueryConnectionUpdater('recipes', 'Recipe');
    const cache = createMockCache();

    remove(cache, 'r-1', { updateTotalCount: false });

    const helpers = createFieldHelpers();
    helpers.readField.mockReturnValue('r-1');

    const existingConnection = {
      edges: [{ node: { __ref: 'Recipe:r-1' } }],
      totalCount: 5,
    };
    const result = invokeFieldModifier(
      cache,
      'recipes',
      existingConnection,
      helpers,
    );

    expect(result.totalCount).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// createAddToParentConnectionUpdater
// ---------------------------------------------------------------------------

describe('createAddToParentConnectionUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('modifies the correct parent entity by cache id', () => {
    const addToPantryItems = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    addToPantryItems(cache, 'pantry-1', {
      id: 'pi-1',
      __typename: 'PantryItem',
    } as any);

    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'Pantry:pantry-1',
      }),
    );
  });

  it('adds a new edge at the start by default', () => {
    const addToPantryItems = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    addToPantryItems(cache, 'pantry-1', {
      id: 'pi-new',
      __typename: 'PantryItem',
    } as any);

    const helpers = createFieldHelpers();
    const existing = {
      edges: [{ node: { __ref: 'PantryItem:pi-old' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[0].__typename).toBe('PantryItemEdge');
    expect(result.edges[0].cursor).toBe('');
    expect(result.totalCount).toBe(2);
  });

  it('adds a new edge at the end when position is end', () => {
    const add = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(cache, 'p-1', { id: 'pi-new', __typename: 'PantryItem' } as any, { position: 'end' });

    const helpers = createFieldHelpers();
    const existing = {
      edges: [{ node: { __ref: 'PantryItem:pi-old' } }],
      totalCount: 1,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.edges).toHaveLength(2);
    expect(result.edges[1].__typename).toBe('PantryItemEdge');
  });

  it('prevents duplicates by default', () => {
    const add = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(cache, 'p-1', { id: 'pi-1', __typename: 'PantryItem' } as any);

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string) => {
      if (field === 'id') return 'pi-1';
      return undefined;
    });
    const existing = {
      edges: [{ node: { __ref: 'PantryItem:pi-1' } }],
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

  it('warns and returns early when parent not found in cache', () => {
    const add = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    add(cache, 'p-missing', { id: 'pi-1', __typename: 'PantryItem' } as any);

    expect(cache.modify).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );

    warnSpy.mockRestore();
  });

  it('does not update totalCount when updateTotalCount is false', () => {
    const add = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(
      cache,
      'p-1',
      { id: 'pi-new', __typename: 'PantryItem' } as any,
      { updateTotalCount: false },
    );

    const helpers = createFieldHelpers();
    const existing = { edges: [], totalCount: 5 };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.totalCount).toBe(5);
  });

  it('returns existing connection when toReference returns undefined', () => {
    const add = createAddToParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(cache, 'p-1', { id: 'pi-1', __typename: 'PantryItem' } as any);

    const helpers = createFieldHelpers();
    helpers.toReference.mockReturnValue(undefined);
    const existing = { edges: [], totalCount: 0 };
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
// createAddToParentArrayUpdater
// ---------------------------------------------------------------------------

describe('createAddToParentArrayUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a new item ref at the start by default', () => {
    const addToItems = createAddToParentArrayUpdater('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-new', __typename: 'PantryItem' } as any);

    const helpers = createFieldHelpers();
    const existing = [{ __ref: 'PantryItem:item-old' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toHaveLength(2);
    expect(result[1]).toBe(existing[0]);
  });

  it('adds at the end when position is end', () => {
    const addToItems = createAddToParentArrayUpdater('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-new', __typename: 'PantryItem' } as any, { position: 'end' });

    const helpers = createFieldHelpers();
    const existing = [{ __ref: 'PantryItem:item-old' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existing[0]);
  });

  it('prevents duplicates by default', () => {
    const addToItems = createAddToParentArrayUpdater('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-1', __typename: 'PantryItem' } as any);

    const helpers = createFieldHelpers();
    helpers.readField.mockReturnValue('item-1');
    const existing = [{ __ref: 'PantryItem:item-1' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toBe(existing);
  });

  it('modifies the correct parent entity', () => {
    const addToItems = createAddToParentArrayUpdater('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-1', __typename: 'PantryItem' } as any);

    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Pantry:p-1' }),
    );
  });

  it('warns and returns early when parent not found', () => {
    const addToItems = createAddToParentArrayUpdater('Pantry', 'items');
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    addToItems(cache, 'p-missing', { id: 'item-1', __typename: 'PantryItem' } as any);

    expect(cache.modify).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );

    warnSpy.mockRestore();
  });

  it('returns existing items when toReference returns undefined', () => {
    const addToItems = createAddToParentArrayUpdater('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-1', __typename: 'PantryItem' } as any);

    const helpers = createFieldHelpers();
    helpers.toReference.mockReturnValue(undefined);
    const existing = [{ __ref: 'PantryItem:old' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toBe(existing);
  });
});

// ---------------------------------------------------------------------------
// createRemoveFromParentConnectionUpdater
// ---------------------------------------------------------------------------

describe('createRemoveFromParentConnectionUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('removes the edge with the matching item id', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, ref: any) => {
      if (field === 'id') {
        if (ref?.__ref === 'PantryItem:pi-1') return 'pi-1';
        if (ref?.__ref === 'PantryItem:pi-2') return 'pi-2';
      }
      return undefined;
    });

    const existing = {
      edges: [
        { node: { __ref: 'PantryItem:pi-1' } },
        { node: { __ref: 'PantryItem:pi-2' } },
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

  it('modifies the correct parent entity', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'ShoppingList',
      'itemsConnection',
      'ShoppingListItem',
    );
    const cache = createMockCache();

    remove(cache, 'sl-1', 'sli-1');

    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ShoppingList:sl-1' }),
    );
  });

  it('evicts the item and runs gc when evictItem is true', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1', { evictItem: true });

    expect(cache.evict).toHaveBeenCalledWith({ id: 'PantryItem:pi-1' });
    expect(cache.gc).toHaveBeenCalled();
  });

  it('does not evict by default', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1');

    expect(cache.evict).not.toHaveBeenCalled();
  });

  it('skips gc when gc is false', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1', { evictItem: true, gc: false });

    expect(cache.evict).toHaveBeenCalled();
    expect(cache.gc).not.toHaveBeenCalled();
  });

  it('clamps totalCount to 0', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockReturnValue('pi-1');
    const existing = {
      edges: [{ node: { __ref: 'PantryItem:pi-1' } }],
      totalCount: 0,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.totalCount).toBe(0);
  });

  it('warns and returns early when parent not found', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    remove(cache, 'p-missing', 'pi-1');

    expect(cache.modify).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );

    warnSpy.mockRestore();
  });

  it('does not update totalCount when updateTotalCount is false', () => {
    const remove = createRemoveFromParentConnectionUpdater(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1', { updateTotalCount: false });

    const helpers = createFieldHelpers();
    helpers.readField.mockReturnValue('pi-1');
    const existing = {
      edges: [{ node: { __ref: 'PantryItem:pi-1' } }],
      totalCount: 10,
    };
    const result = invokeFieldModifier(
      cache,
      'itemsConnection',
      existing,
      helpers,
    );

    expect(result.totalCount).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// createRemoveFromParentArrayUpdater
// ---------------------------------------------------------------------------

describe('createRemoveFromParentArrayUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters out the item with the matching id', () => {
    const remove = createRemoveFromParentArrayUpdater(
      'Pantry',
      'items',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1');

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string, ref: any) => {
      if (field === 'id') {
        if (ref.__ref === 'PantryItem:pi-1') return 'pi-1';
        if (ref.__ref === 'PantryItem:pi-2') return 'pi-2';
      }
      return undefined;
    });

    const existing = [
      { __ref: 'PantryItem:pi-1' },
      { __ref: 'PantryItem:pi-2' },
    ];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toHaveLength(1);
    expect(result[0].__ref).toBe('PantryItem:pi-2');
  });

  it('modifies the correct parent entity', () => {
    const remove = createRemoveFromParentArrayUpdater(
      'Pantry',
      'items',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1');

    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Pantry:p-1' }),
    );
  });

  it('evicts the item and runs gc when evictItem is true', () => {
    const remove = createRemoveFromParentArrayUpdater(
      'Pantry',
      'items',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1', { evictItem: true });

    expect(cache.evict).toHaveBeenCalledWith({ id: 'PantryItem:pi-1' });
    expect(cache.gc).toHaveBeenCalled();
  });

  it('does not evict by default', () => {
    const remove = createRemoveFromParentArrayUpdater(
      'Pantry',
      'items',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1');

    expect(cache.evict).not.toHaveBeenCalled();
  });

  it('skips gc when gc is false', () => {
    const remove = createRemoveFromParentArrayUpdater(
      'Pantry',
      'items',
      'PantryItem',
    );
    const cache = createMockCache();

    remove(cache, 'p-1', 'pi-1', { evictItem: true, gc: false });

    expect(cache.evict).toHaveBeenCalled();
    expect(cache.gc).not.toHaveBeenCalled();
  });

  it('warns and returns early when parent not found', () => {
    const remove = createRemoveFromParentArrayUpdater(
      'Pantry',
      'items',
      'PantryItem',
    );
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    remove(cache, 'p-missing', 'pi-1');

    expect(cache.modify).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// createItemEvictor
// ---------------------------------------------------------------------------

describe('createItemEvictor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('evicts the item by typename and id', () => {
    const evictItem = createItemEvictor('PantryItem');
    const cache = createMockCache();

    evictItem(cache, 'pi-1');

    expect(cache.evict).toHaveBeenCalledWith({ id: 'PantryItem:pi-1' });
  });

  it('runs gc after eviction', () => {
    const evictItem = createItemEvictor('Recipe');
    const cache = createMockCache();

    evictItem(cache, 'r-1');

    expect(cache.gc).toHaveBeenCalled();
  });

  it('does not throw when eviction fails', () => {
    const evictItem = createItemEvictor('Item');
    const cache = createMockCache();
    cache.evict.mockImplementation(() => {
      throw new Error('evict error');
    });
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

    expect(() => evictItem(cache, 'i-1')).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cache eviction failed'),
      expect.any(Object),
    );

    warnSpy.mockRestore();
  });
});
