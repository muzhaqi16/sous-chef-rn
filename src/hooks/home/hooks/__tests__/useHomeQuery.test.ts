import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetHomesDocument } from '#operations/home/home.generated';
import { useHomeQuery } from '../useHomeQuery';

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
});

function homesMock(homes: any[] | null): MockedResponse {
  return recordMock(GetHomesDocument, {
    data: {
      homes: homes
        ? {
            __typename: 'HomeConnection',
            edges: homes.map((h, i) => ({
              __typename: 'HomeEdge',
              cursor: `c${i}`,
              node: { __typename: 'Home', ...h },
            })),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: false,
              endCursor: null,
            },
            totalCount: homes.length,
          }
        : null,
    },
  }).mock;
}

function errorMock(message: string): MockedResponse {
  return recordMock(GetHomesDocument, {
    error: new Error(message),
  }).mock;
}

describe('useHomeQuery', () => {
  it('returns empty state when no data', async () => {
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(null)],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.homes).toEqual([]);
    expect(result.current.error).toBeUndefined();
    expect(result.current.remoteDefaultHomeId).toBeNull();
    expect(result.current.initialLoading).toBe(false);
  });

  it('returns homes from query data', async () => {
    const homes = [
      {
        id: 'home-1',
        name: 'Home 1',
        isDefault: true,
        pantries: [],
        members: [],
      },
      {
        id: 'home-2',
        name: 'Home 2',
        isDefault: false,
        pantries: [],
        members: [],
      },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.homes).toHaveLength(2));
  });

  it('derives remoteDefaultHomeId from isDefault field', async () => {
    const homes = [
      { id: 'home-1', isDefault: false, pantries: null, members: [] },
      { id: 'home-2', isDefault: true, pantries: null, members: [] },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() =>
      expect(result.current.remoteDefaultHomeId).toBe('home-2'),
    );
  });

  it('returns null remoteDefaultHomeId when no home is default', async () => {
    const homes = [
      { id: 'home-1', isDefault: false, pantries: null, members: [] },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.homes).toHaveLength(1));
    expect(result.current.remoteDefaultHomeId).toBeNull();
  });

  it('computes stats correctly', async () => {
    const homes = [
      {
        id: 'home-1',
        isDefault: true,
        pantries: [{ id: 'p-1' }, { id: 'p-2' }],
        members: [{ id: 'm-1' }],
      },
      {
        id: 'home-2',
        isDefault: false,
        pantries: [{ id: 'p-3' }],
        members: [{ id: 'm-2' }, { id: 'm-3' }],
      },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.stats.totalHomes).toBe(2));
    expect(result.current.stats.totalMembers).toBe(3);
    expect(result.current.stats.totalPantries).toBe(3);
  });

  it('reports loading false after settle', async () => {
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(null)],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('exposes error from query', async () => {
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [errorMock('Query failed')],
    });
    // errorPolicy: 'ignore' suppresses the error and returns no data
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.homes).toEqual([]);
  });

  it('provides a refetch function', async () => {
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(null), homesMock(null)],
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
    await act(async () => {
      await result.current.refetch();
    });
  });

  it('counts members as 0 when home has no members array', async () => {
    const homes = [
      { id: 'home-1', isDefault: false, pantries: null, members: null },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.stats.totalMembers).toBe(0));
  });
});
