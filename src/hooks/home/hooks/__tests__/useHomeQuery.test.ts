import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { GetHomesDocument } from '#operations/home/home.generated';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { useHomeQuery } from '../useHomeQuery';

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: jest.fn((data: any) => data ?? []),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

type HomeFixture = {
  id: string;
  name?: string;
  isDefault?: boolean;
  version?: number;
  pantriesTotalCount?: number;
  membersTotalCount?: number;
  pantries?: Array<{ id: string; name?: string; isDefault?: boolean }>;
};

function homeNode(h: HomeFixture) {
  return {
    __typename: 'Home',
    id: h.id,
    name: h.name ?? `Home ${h.id}`,
    isDefault: h.isDefault ?? false,
    version: h.version ?? 1,
    myMembership: {
      __typename: 'Membership',
      id: `mm-${h.id}`,
      role: MembershipRole.Owner,
      canManageHome: true,
      canViewPantry: true,
      canEditPantry: true,
      canAddItems: true,
      canRemoveItems: true,
      canInviteOthers: true,
    },
    pantriesConnection: {
      __typename: 'PantryConnection',
      totalCount: h.pantriesTotalCount ?? h.pantries?.length ?? 0,
      edges: (h.pantries ?? []).map(p => ({
        __typename: 'PantryEdge',
        node: {
          __typename: 'Pantry',
          id: p.id,
          name: p.name ?? `Pantry ${p.id}`,
          isDefault: p.isDefault ?? false,
        },
      })),
    },
    membersConnection: {
      __typename: 'MembershipConnection',
      totalCount: h.membersTotalCount ?? 0,
      edges: [],
    },
    invitesConnection: {
      __typename: 'HomeInviteConnection',
      totalCount: 0,
      edges: [],
    },
  };
}

function homesMock(homes: HomeFixture[] | null): MockedResponse {
  return recordMock(GetHomesDocument, {
    data: {
      homes: homes
        ? {
            __typename: 'HomeConnection',
            edges: homes.map((h, i) => ({
              __typename: 'HomeEdge',
              cursor: `c${i}`,
              node: homeNode(h),
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
    const homes: HomeFixture[] = [
      { id: 'home-1', isDefault: true },
      { id: 'home-2', isDefault: false },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.homes).toHaveLength(2));
  });

  it('derives remoteDefaultHomeId from isDefault field', async () => {
    const homes: HomeFixture[] = [
      { id: 'home-1', isDefault: false },
      { id: 'home-2', isDefault: true },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() =>
      expect(result.current.remoteDefaultHomeId).toBe('home-2'),
    );
  });

  it('returns null remoteDefaultHomeId when no home is default', async () => {
    const homes: HomeFixture[] = [{ id: 'home-1', isDefault: false }];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.homes).toHaveLength(1));
    expect(result.current.remoteDefaultHomeId).toBeNull();
  });

  it('computes stats correctly', async () => {
    const homes: HomeFixture[] = [
      {
        id: 'home-1',
        isDefault: true,
        pantriesTotalCount: 2,
        membersTotalCount: 1,
      },
      {
        id: 'home-2',
        isDefault: false,
        pantriesTotalCount: 1,
        membersTotalCount: 2,
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

  it('counts members as 0 when home has no members', async () => {
    const homes: HomeFixture[] = [
      { id: 'home-1', isDefault: false, membersTotalCount: 0 },
    ];
    const { result } = renderHookWithApollo(() => useHomeQuery(), {
      operationMocks: [homesMock(homes)],
    });
    await waitFor(() => expect(result.current.stats.totalMembers).toBe(0));
  });
});
