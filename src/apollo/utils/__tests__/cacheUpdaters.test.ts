import type { ApolloCache } from '@apollo/client';
import {
  createAddToQueryConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  createAddToParentConnectionUpdater,
  createAddToParentArrayUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromParentArrayUpdater,
} from '../cacheUpdaters';

/** Mock Apollo cache exposing the methods the updaters touch as jest mocks. */
type MockedCache = ApolloCache & {
  modify: jest.Mock;
  evict: jest.Mock;
  gc: jest.Mock;
  identify: jest.Mock;
};

/** Field-modifier helpers passed to each `cache.modify` field function. */
interface FieldHelpers {
  toReference: jest.Mock;
  readField: jest.Mock;
  storeFieldName: string;
}

/** A cache ref or normalized object the field helpers read from. */
type MockRef = { __ref?: string; [key: string]: unknown };

/**
 * Entity shape the add-updaters operate on. The factories' `T` defaults to
 * its `{ id: string }` constraint (T can't be inferred from the string args),
 * so we pass this explicitly to allow the `__typename` the mock helpers read.
 */
type Entity = { id: string; __typename: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock Apollo cache with jest.fn() for all methods we use.
 * `modify` captures the fields object so we can invoke field functions
 * in assertions.
 */
function createMockCache(): MockedCache {
  return {
    modify: jest.fn(),
    evict: jest.fn(),
    gc: jest.fn(),
    identify: jest.fn(
      (obj: { __typename: string; id: string }) =>
        `${obj.__typename}:${obj.id}`,
    ),
  } as MockedCache;
}

/** Standard field helpers reused across tests */
function createFieldHelpers(
  overrides: Partial<FieldHelpers> = {},
): FieldHelpers {
  return {
    toReference: jest.fn((item?: { __typename: string; id: string }) =>
      item ? { __ref: `${item.__typename}:${item.id}` } : undefined,
    ),
    readField: jest.fn((fieldName: string, ref?: MockRef) => {
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
  mockCache: MockedCache,
  fieldName: string,
  existingValue: unknown,
  helpers: FieldHelpers,
  callIndex = 0,
) {
  const modifyCall = mockCache.modify.mock.calls[callIndex];
  const fields = modifyCall[0].fields;
  return fields[fieldName](existingValue, helpers);
}

// ---------------------------------------------------------------------------
// createAddToQueryConnectionUpdater
// ---------------------------------------------------------------------------

describe('createAddToQueryConnectionUpdater', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('adds a new edge at the start by default', () => {
    const addToShoppingLists = createAddToQueryConnectionUpdater<Entity>(
      'shoppingLists',
      'ShoppingList',
    );
    const cache = createMockCache();
    const newItem = {
      id: 'sl-1',
      __typename: 'ShoppingList',
      name: 'Groceries',
    };

    addToShoppingLists(cache, newItem);

    const helpers = createFieldHelpers();
    const existingConnection = {
      edges: [
        {
          __typename: 'ShoppingListEdge',
          node: { __ref: 'ShoppingList:sl-2' },
          cursor: 'c1',
        },
      ],
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
    const addToLists = createAddToQueryConnectionUpdater<Entity>(
      'lists',
      'List',
    );
    const cache = createMockCache();

    addToLists(
      cache,
      { id: 'l-1', __typename: 'List' },
      {
        position: 'end',
      },
    );

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
    const addToLists = createAddToQueryConnectionUpdater<Entity>(
      'lists',
      'List',
    );
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' });

    const helpers = createFieldHelpers();
    helpers.readField.mockImplementation((field: string) => {
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
    const addToLists = createAddToQueryConnectionUpdater<Entity>(
      'lists',
      'List',
    );
    const cache = createMockCache();

    addToLists(
      cache,
      { id: 'l-1', __typename: 'List' },
      {
        updateTotalCount: false,
      },
    );

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
    const addToLists = createAddToQueryConnectionUpdater<Entity>(
      'lists',
      'List',
    );
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' });

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
    const addToLists = createAddToQueryConnectionUpdater<Entity>(
      'lists',
      'List',
    );
    const cache = createMockCache();

    addToLists(cache, { id: 'l-1', __typename: 'List' });

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
    const addToPantryItems = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    addToPantryItems(cache, 'pantry-1', {
      id: 'pi-1',
      __typename: 'PantryItem',
    });

    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'Pantry:pantry-1',
      }),
    );
  });

  it('adds a new edge at the start by default', () => {
    const addToPantryItems = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    addToPantryItems(cache, 'pantry-1', {
      id: 'pi-new',
      __typename: 'PantryItem',
    });

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
    const add = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(
      cache,
      'p-1',
      { id: 'pi-new', __typename: 'PantryItem' },
      {
        position: 'end',
      },
    );

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
    const add = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(cache, 'p-1', { id: 'pi-1', __typename: 'PantryItem' });

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
    const add = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    add(cache, 'p-missing', { id: 'pi-1', __typename: 'PantryItem' });

    expect(cache.modify).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );
  });

  it('does not update totalCount when updateTotalCount is false', () => {
    const add = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(
      cache,
      'p-1',
      { id: 'pi-new', __typename: 'PantryItem' },
      {
        updateTotalCount: false,
      },
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
    const add = createAddToParentConnectionUpdater<Entity>(
      'Pantry',
      'itemsConnection',
      'PantryItem',
    );
    const cache = createMockCache();

    add(cache, 'p-1', { id: 'pi-1', __typename: 'PantryItem' });

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
    const addToItems = createAddToParentArrayUpdater<Entity>('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', {
      id: 'item-new',
      __typename: 'PantryItem',
    });

    const helpers = createFieldHelpers();
    const existing = [{ __ref: 'PantryItem:item-old' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toHaveLength(2);
    expect(result[1]).toBe(existing[0]);
  });

  it('adds at the end when position is end', () => {
    const addToItems = createAddToParentArrayUpdater<Entity>('Pantry', 'items');
    const cache = createMockCache();

    addToItems(
      cache,
      'p-1',
      { id: 'item-new', __typename: 'PantryItem' },
      { position: 'end' },
    );

    const helpers = createFieldHelpers();
    const existing = [{ __ref: 'PantryItem:item-old' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(existing[0]);
  });

  it('prevents duplicates by default', () => {
    const addToItems = createAddToParentArrayUpdater<Entity>('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-1', __typename: 'PantryItem' });

    const helpers = createFieldHelpers();
    helpers.readField.mockReturnValue('item-1');
    const existing = [{ __ref: 'PantryItem:item-1' }];
    const result = invokeFieldModifier(cache, 'items', existing, helpers);

    expect(result).toBe(existing);
  });

  it('modifies the correct parent entity', () => {
    const addToItems = createAddToParentArrayUpdater<Entity>('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-1', __typename: 'PantryItem' });

    expect(cache.modify).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Pantry:p-1' }),
    );
  });

  it('warns and returns early when parent not found', () => {
    const addToItems = createAddToParentArrayUpdater<Entity>('Pantry', 'items');
    const cache = createMockCache();
    cache.identify.mockReturnValue(undefined);

    addToItems(cache, 'p-missing', {
      id: 'item-1',
      __typename: 'PantryItem',
    });

    expect(cache.modify).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );
  });

  it('returns existing items when toReference returns undefined', () => {
    const addToItems = createAddToParentArrayUpdater<Entity>('Pantry', 'items');
    const cache = createMockCache();

    addToItems(cache, 'p-1', { id: 'item-1', __typename: 'PantryItem' });

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

    remove(cache, 'p-missing', 'pi-1');

    expect(cache.modify).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );
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

    remove(cache, 'p-missing', 'pi-1');

    expect(cache.modify).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('Parent entity not found'),
    );
  });
});
