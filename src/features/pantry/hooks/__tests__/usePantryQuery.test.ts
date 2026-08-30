'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import {
  type PantryItemOrderBy,
  SortOrder,
} from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store/index';
import { usePantryQuery } from '../usePantryQuery';

type MockEdge = { node?: { id?: string } | null } | null;
type MockConnection = {
  edges?: MockEdge[] | null;
  totalCount?: number | null;
};

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#/utils/connectionUtils', () => ({
  extractNodes: jest.fn((connection: MockConnection) => {
    if (!connection?.edges) return [];
    return connection.edges
      .map((edge: MockEdge) => edge?.node)
      .filter((node: { id?: string } | null | undefined) => node != null);
  }),
  getConnectionTotalCount: jest.fn((connection: MockConnection) => {
    if (typeof connection?.totalCount === 'number')
      return connection.totalCount;
    return connection?.edges?.length ?? 0;
  }),
}));

jest.mock('#/hooks/utils/usePagination', () => ({
  usePagination: jest.fn(() => ({
    hasMore: false,
    loadMore: jest.fn(),
    isLoadingMore: false,
  })),
}));

// The pantry query does not touch subscriptionService — pending-delete
// echoes are filtered at the subscription-handler layer instead. The mock is
// registered empty so any accidental call fails loudly.
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {},
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: <T>(data: T[] | null | undefined) => data || [],
  usePreservedQueryData: <T>(data: T | undefined, initial: T) =>
    data !== undefined ? data : initial,
}));

const mockSetIsPantryQueryComplete = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(
    <T>(selector: (state: RootState) => T): T =>
      selector({
        isHomeSelectionReady: true,
        setIsPantryQueryComplete: mockSetIsPantryQueryComplete,
      } as Partial<RootState> as RootState),
  ),
  useIsHomeSelectionReady: jest.fn(() => true),
  useSetIsPantryQueryComplete: jest.fn(() => mockSetIsPantryQueryComplete),
}));

global.requestIdleCallback = jest.fn((cb: IdleRequestCallback) => {
  cb({ didTimeout: false, timeRemaining: () => 0 });
  return 1;
});
global.cancelIdleCallback = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePantryQuery', () => {
  it('returns empty items when no pantryId', () => {
    // No mocks needed — the query is skipped, MockedProvider sees nothing fire.
    const { result } = renderHookWithApollo(() => usePantryQuery(undefined));

    expect(result.current.state.pantryItems).toEqual([]);
    expect(result.current.state.loading).toBe(false);
  });

  it('skips query when pantryId is empty string', () => {
    // Empty pantryId → skip:true → no operationMocks needed
    const { result } = renderHookWithApollo(() => usePantryQuery(''));

    expect(result.current.state.pantryItems).toEqual([]);
    expect(result.current.state.loading).toBe(false);
  });

  it('executes query when pantryId is valid (settles via schema-mocked schema link)', async () => {
    // Use schema-driven mocks — the GetPantry query has a deeply nested
    // selection set that would be tedious to spell out by hand. Schema mocks
    // synthesize sane defaults for every field.
    const { result } = renderHookWithApollo(() => usePantryQuery('pantry-1'), {
      mocks: {
        Query: () => ({
          pantry: { id: 'pantry-1', name: 'Test Pantry' },
        }),
      },
    });

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    // Once the query resolves, extractNodes returns an array.
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });

  it('passes itemsOrderBy / itemsFirst to query variables', async () => {
    // We can't directly inspect Apollo's call site for variables, but if the
    // query fires successfully with our schema-driven setup, the variables are
    // implicitly correct (the schema doesn't validate variable values, only
    // shape — so this test mainly ensures no runtime error from passing
    // orderBy through).
    const orderBy: PantryItemOrderBy = { itemName: SortOrder.Asc };
    const { result } = renderHookWithApollo(
      () => usePantryQuery('pantry-1', null, orderBy),
      {
        mocks: {
          Query: () => ({ pantry: { id: 'pantry-1' } }),
        },
      },
    );

    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });

  it('returns pantry items extracted from query connection', async () => {
    const { result } = renderHookWithApollo(() => usePantryQuery('pantry-1'), {
      mocks: {
        Query: () => ({
          pantry: {
            id: 'pantry-1',
            itemsConnection: {
              edges: [
                {
                  node: { id: 'item-1', itemName: 'Milk' },
                  cursor: 'c1',
                },
              ],
              totalCount: 1,
              pageInfo: { hasNextPage: false, endCursor: null },
            },
          },
        }),
        PantryItem: (_root: unknown, args: { id?: string }) => ({
          id: args?.id ?? 'item-1',
          itemName: 'Milk',
        }),
      },
    });

    await waitFor(() => {
      expect(result.current.state.pantryItems.length).toBeGreaterThan(0);
    });
    expect(result.current.state.pantryItems[0]).toMatchObject({
      itemName: 'Milk',
    });
    expect(result.current.state.totalCount).toBe(1);
  });

  it('provides refetch that tracks refreshing state', async () => {
    const { result } = renderHookWithApollo(() => usePantryQuery('pantry-1'), {
      mocks: { Query: () => ({ pantry: { id: 'pantry-1' } }) },
    });

    await waitFor(() => expect(result.current.state.loading).toBe(false));

    expect(typeof result.current.actions.refetch).toBe('function');
    await act(async () => {
      await result.current.actions.refetch();
    });
  });

  it('signals pantry query complete when not loading and valid pantryId', async () => {
    renderHookWithApollo(() => usePantryQuery('pantry-1'), {
      mocks: { Query: () => ({ pantry: { id: 'pantry-1' } }) },
    });

    await waitFor(() => {
      expect(mockSetIsPantryQueryComplete).toHaveBeenCalledWith(true);
    });
  });

  it('resets pantry query complete when pantryId becomes invalid', () => {
    renderHookWithApollo(() => usePantryQuery(undefined));

    expect(mockSetIsPantryQueryComplete).toHaveBeenCalledWith(false);
  });

  it('returns pagination helpers', () => {
    const { result } = renderHookWithApollo(() => usePantryQuery('pantry-1'));

    expect(result.current.state.hasMore).toBe(false);
    expect(typeof result.current.actions.loadMore).toBe('function');
    expect(result.current.state.isLoadingMore).toBe(false);
  });

  it('returns items directly from the cache (pending-delete filtering now happens in subscription handlers)', () => {
    const { result } = renderHookWithApollo(() => usePantryQuery('pantry-1'));

    // Items come straight from extractNodes(itemsConnection) →
    // usePreservedArrayData with no intermediate JS-layer filtering. The Apollo
    // cache is the single source of truth; pending-delete echoes are skipped
    // at the subscription handler level in `usePantrySubscriptions.ts`.
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });
});

describe('usePantryQuery: consumer options', () => {
  it('stands the query down while options.skip is set, even with a valid pantryId', () => {
    // No mocks: nothing may fire. A secondary consumer (the Recipes tab's
    // discovery hook) passes this while its screen is blurred so a pantry
    // write on another tab cannot re-render it.
    const { result } = renderHookWithApollo(() =>
      usePantryQuery('pantry-1', null, null, undefined, { skip: true }),
    );
    expect(result.current.state.skipped).toBe(true);
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.pantryItems).toEqual([]);
  });

  it('starts the query once options.skip is lifted', async () => {
    const { result, rerender } = renderHookWithApollo(
      ({ skip }: { skip: boolean }) =>
        usePantryQuery('pantry-1', null, null, undefined, {
          skip,
          fetchPolicy: 'cache-first',
        }),
      {
        initialProps: { skip: true },
        mocks: {
          Query: () => ({ pantry: { id: 'pantry-1', name: 'Test Pantry' } }),
        },
      },
    );
    expect(result.current.state.skipped).toBe(true);

    rerender({ skip: false });
    await waitFor(() => expect(result.current.state.loading).toBe(false));
    expect(result.current.state.skipped).toBe(false);
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });
});
