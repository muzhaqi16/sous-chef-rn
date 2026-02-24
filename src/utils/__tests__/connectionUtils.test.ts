import {
  extractNodes,
  getConnectionTotalCount,
  normalizeConnectionField,
  normalizeConnection,
  normalizeHome,
  normalizePantry,
  normalizeShoppingList,
  normalizeRecipes,
} from '../connectionUtils';

describe('extractNodes', () => {
  it('extracts nodes from edges', () => {
    const connection = {
      edges: [
        { node: { id: '1', name: 'A' } },
        { node: { id: '2', name: 'B' } },
      ],
    };
    expect(extractNodes(connection)).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('filters out null edges', () => {
    const connection = {
      edges: [{ node: { id: '1' } }, null, { node: { id: '2' } }],
    };
    expect(extractNodes(connection)).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('filters out null nodes', () => {
    const connection = {
      edges: [{ node: { id: '1' } }, { node: null }, { node: { id: '2' } }],
    };
    expect(extractNodes(connection)).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('returns empty array for null connection', () => {
    expect(extractNodes(null)).toEqual([]);
  });

  it('returns empty array for undefined connection', () => {
    expect(extractNodes(undefined)).toEqual([]);
  });

  it('returns empty array for connection with null edges', () => {
    expect(extractNodes({ edges: null })).toEqual([]);
  });

  it('returns empty array for connection with empty edges', () => {
    expect(extractNodes({ edges: [] })).toEqual([]);
  });
});

describe('getConnectionTotalCount', () => {
  it('returns totalCount when available', () => {
    const connection = { totalCount: 42, edges: [] };
    expect(getConnectionTotalCount(connection)).toBe(42);
  });

  it('returns 0 for totalCount of 0', () => {
    const connection = { totalCount: 0, edges: [] };
    expect(getConnectionTotalCount(connection)).toBe(0);
  });

  it('falls back to node count when totalCount is null', () => {
    const connection = {
      totalCount: null,
      edges: [{ node: { id: '1' } }, { node: { id: '2' } }],
    };
    expect(getConnectionTotalCount(connection)).toBe(2);
  });

  it('falls back to node count when totalCount is undefined', () => {
    const connection = {
      edges: [{ node: { id: '1' } }],
    };
    expect(getConnectionTotalCount(connection)).toBe(1);
  });

  it('returns 0 for null connection', () => {
    expect(getConnectionTotalCount(null)).toBe(0);
  });
});

describe('normalizeConnectionField', () => {
  const entity = {
    id: '1',
    itemsConnection: {
      edges: [{ node: { id: 'item-1' } }, { node: { id: 'item-2' } }],
      totalCount: 5,
      pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
    },
  };

  it('normalizes array field', () => {
    const result = normalizeConnectionField(entity, {
      connectionField: 'itemsConnection',
      arrayName: 'items',
    });
    expect(result.items).toEqual([{ id: 'item-1' }, { id: 'item-2' }]);
    expect(result.itemsTotalCount).toBeUndefined();
    expect(result.itemsPageInfo).toBeUndefined();
  });

  it('includes totalCount when configured', () => {
    const result = normalizeConnectionField(entity, {
      connectionField: 'itemsConnection',
      arrayName: 'items',
      includeTotalCount: true,
    });
    expect(result.itemsTotalCount).toBe(5);
  });

  it('includes pageInfo when configured', () => {
    const result = normalizeConnectionField(entity, {
      connectionField: 'itemsConnection',
      arrayName: 'items',
      includePageInfo: true,
    });
    expect(result.itemsPageInfo).toEqual({
      hasNextPage: true,
      endCursor: 'cursor-1',
    });
  });
});

describe('normalizeConnection', () => {
  it('normalizes a standalone connection', () => {
    const connection = {
      edges: [{ node: { id: '1' } }, { node: { id: '2' } }],
      totalCount: 10,
      pageInfo: { hasNextPage: true, endCursor: 'c1' },
    };
    const result = normalizeConnection(connection, 'recipes');
    expect(result).toEqual({
      recipes: [{ id: '1' }, { id: '2' }],
      totalCount: 10,
      pageInfo: { hasNextPage: true, endCursor: 'c1' },
    });
  });

  it('returns null for null connection', () => {
    expect(normalizeConnection(null)).toBeNull();
  });

  it('defaults arrayName to items', () => {
    const connection = { edges: [{ node: { id: '1' } }], totalCount: 1 };
    const result = normalizeConnection(connection);
    expect(result!.items).toEqual([{ id: '1' }]);
  });
});

describe('normalizeHome', () => {
  it('normalizes home with members, invites, pantries', () => {
    const home = {
      id: 'home-1',
      name: 'My Home',
      membersConnection: {
        edges: [{ node: { id: 'm1' } }],
        pageInfo: { hasNextPage: false },
      },
      invitesConnection: {
        edges: [{ node: { id: 'i1' } }],
        pageInfo: { hasNextPage: false },
      },
      pantriesConnection: {
        edges: [{ node: { id: 'p1' } }],
        pageInfo: { hasNextPage: false },
      },
    };
    const result = normalizeHome(home);
    expect(result).not.toBeNull();
    expect(result!.members).toEqual([{ id: 'm1' }]);
    expect(result!.invites).toEqual([{ id: 'i1' }]);
    expect(result!.pantries).toEqual([{ id: 'p1' }]);
  });

  it('returns null for null home', () => {
    expect(normalizeHome(null)).toBeNull();
  });
});

describe('normalizePantry', () => {
  it('normalizes pantry with items and storage locations', () => {
    const pantry = {
      id: 'pantry-1',
      itemsConnection: {
        edges: [{ node: { id: 'item-1' } }],
        totalCount: 1,
        pageInfo: { hasNextPage: false },
      },
      storageLocationsConnection: {
        edges: [{ node: { id: 'loc-1' } }],
        totalCount: 1,
        pageInfo: { hasNextPage: false },
      },
    };
    const result = normalizePantry(pantry);
    expect(result).not.toBeNull();
    expect(result!.items).toEqual([{ id: 'item-1' }]);
    expect(result!.storageLocations).toEqual([{ id: 'loc-1' }]);
    expect(result!.itemsTotalCount).toBe(1);
    expect(result!.storageLocationsTotalCount).toBe(1);
  });

  it('returns null for null pantry', () => {
    expect(normalizePantry(null)).toBeNull();
  });
});

describe('normalizeShoppingList', () => {
  it('normalizes shopping list with items', () => {
    const list = {
      itemsConnection: {
        edges: [{ node: { id: 'si-1' } }],
        totalCount: 1,
        pageInfo: { hasNextPage: false },
      },
    };
    const result = normalizeShoppingList(list);
    expect(result).not.toBeNull();
    expect(result!.items).toEqual([{ id: 'si-1' }]);
    expect(result!.itemsTotalCount).toBe(1);
  });
});

describe('normalizeRecipes', () => {
  it('normalizes recipes connection', () => {
    const connection = {
      edges: [{ node: { id: 'r1' } }, { node: { id: 'r2' } }],
      totalCount: 2,
      pageInfo: { hasNextPage: false },
    };
    const result = normalizeRecipes(connection);
    expect(result).not.toBeNull();
    expect(result!.recipes).toEqual([{ id: 'r1' }, { id: 'r2' }]);
    expect(result!.totalCount).toBe(2);
  });

  it('returns null for null connection', () => {
    expect(normalizeRecipes(null)).toBeNull();
  });
});
