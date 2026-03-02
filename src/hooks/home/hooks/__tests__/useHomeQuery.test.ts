import { renderHook, act } from '@testing-library/react-native';
import { useHomeQuery } from '../useHomeQuery';

const mockRefetch = jest.fn().mockResolvedValue({});

const mockQueryResult = {
  data: undefined as any,
  loading: false,
  error: undefined as any,
  refetch: mockRefetch,
};

jest.mock('#generated', () => ({
  useGetHomesQuery: jest.fn(() => mockQueryResult),
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn((data: any) => data ?? []),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHomes: jest.fn((homes: any) => homes ?? []),
  extractNodes: jest.fn((connection: any) => {
    if (!connection?.edges) return [];
    return connection.edges.map((e: any) => e?.node).filter(Boolean);
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockQueryResult.data = undefined;
  mockQueryResult.loading = false;
  mockQueryResult.error = undefined;
  mockRefetch.mockResolvedValue({});
});

describe('useHomeQuery', () => {
  it('returns empty state when no data', () => {
    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.homes).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
    expect(result.current.remoteDefaultHomeId).toBeNull();
    expect(result.current.initialLoading).toBe(false);
  });

  it('returns homes from query data', () => {
    const homes = [
      { id: 'home-1', name: 'Home 1', isDefault: true, pantries: [], members: [] },
      { id: 'home-2', name: 'Home 2', isDefault: false, pantries: [], members: [] },
    ];
    mockQueryResult.data = {
      homes: { edges: homes.map(h => ({ node: h })) },
    };

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.homes).toHaveLength(2);
  });

  it('derives remoteDefaultHomeId from isDefault field', () => {
    mockQueryResult.data = {
      homes: {
        edges: [
          { node: { id: 'home-1', isDefault: false, pantries: null, members: [] } },
          { node: { id: 'home-2', isDefault: true, pantries: null, members: [] } },
        ],
      },
    };

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.remoteDefaultHomeId).toBe('home-2');
  });

  it('returns null remoteDefaultHomeId when no home is default', () => {
    mockQueryResult.data = {
      homes: {
        edges: [
          { node: { id: 'home-1', isDefault: false, pantries: null, members: [] } },
        ],
      },
    };

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.remoteDefaultHomeId).toBeNull();
  });

  it('computes stats correctly', () => {
    mockQueryResult.data = {
      homes: {
        edges: [
          {
            node: {
              id: 'home-1',
              isDefault: true,
              pantries: [{ id: 'p-1' }, { id: 'p-2' }],
              members: [{ id: 'm-1' }],
            },
          },
          {
            node: {
              id: 'home-2',
              isDefault: false,
              pantries: [{ id: 'p-3' }],
              members: [{ id: 'm-2' }, { id: 'm-3' }],
            },
          },
        ],
      },
    };

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.stats.totalHomes).toBe(2);
    expect(result.current.stats.totalMembers).toBe(3);
    expect(result.current.stats.totalPantries).toBe(3);
  });

  it('reports initialLoading as false when homes is an empty array', () => {
    // initialLoading = !homes && loading
    // Since normalizeHomes returns [] (truthy), initialLoading is false
    mockQueryResult.loading = true;

    const { result } = renderHook(() => useHomeQuery());

    // Empty array is truthy so !homes is false
    expect(result.current.initialLoading).toBe(false);
    expect(result.current.loading).toBe(true);
  });

  it('reports loading false when not loading', () => {
    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.loading).toBe(false);
  });

  it('exposes error from query', () => {
    const testError = new Error('Query failed');
    mockQueryResult.error = testError;

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.error).toBe(testError);
  });

  it('provides a refetch function', async () => {
    const { result } = renderHook(() => useHomeQuery());

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('counts members as 0 when home has no members array', () => {
    mockQueryResult.data = {
      homes: {
        edges: [
          {
            node: {
              id: 'home-1',
              isDefault: false,
              pantries: null,
              members: null,
            },
          },
        ],
      },
    };

    const { result } = renderHook(() => useHomeQuery());

    expect(result.current.stats.totalMembers).toBe(0);
  });
});
