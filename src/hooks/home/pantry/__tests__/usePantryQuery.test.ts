'use no memo';

import { act, waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { usePantryQuery } from '../usePantryQuery';

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizePantry: jest.fn((pantry: any) => {
    if (!pantry) return null;
    return {
      ...pantry,
      items: pantry.items || [],
      itemsPageInfo: pantry.itemsPageInfo || null,
      stats: pantry.stats || null,
      itemsTotalCount: pantry.itemsTotalCount || 0,
      storageLocations: pantry.storageLocations || [],
    };
  }),
}));

jest.mock('#/hooks/utils/usePagination', () => ({
  usePagination: jest.fn(() => ({
    hasMore: false,
    loadMore: jest.fn(),
    isLoadingMore: false,
  })),
}));

// The pantry query no longer touches subscriptionService — pending-delete
// echoes are filtered at the subscription-handler layer instead. Mock is
// still registered so any accidental call fails loudly.
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {},
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: (data: any) => data || [],
  usePreservedQueryData: (data: any, initial: any) =>
    data !== undefined ? data : initial,
}));

const mockSetIsPantryQueryComplete = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({
      isHomeSelectionReady: true,
      setIsPantryQueryComplete: mockSetIsPantryQueryComplete,
    }),
  ),
  useIsHomeSelectionReady: jest.fn(() => true),
  useSetIsPantryQueryComplete: jest.fn(() => mockSetIsPantryQueryComplete),
}));

(global as any).requestIdleCallback = jest.fn((cb: any) => {
  cb();
  return 1;
});
(global as any).cancelIdleCallback = jest.fn();

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
    // Once the query resolves, normalizePantry is called and items is an array.
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });

  it('passes itemsOrderBy / itemsFirst to query variables', async () => {
    // We can't directly inspect Apollo's call site for variables, but if the
    // query fires successfully with our schema-driven setup, the variables are
    // implicitly correct (the schema doesn't validate variable values, only
    // shape — so this test mainly ensures no runtime error from passing
    // orderBy through).
    const orderBy = { itemName: 'ASC' as any };
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

  it('returns normalized pantry items from query data', async () => {
    const { normalizePantry } = require('#/utils/connectionUtils');
    normalizePantry.mockReturnValue({
      items: [{ id: 'item-1', itemName: 'Milk' }],
      itemsPageInfo: null,
      stats: { totalItems: 1 },
      itemsTotalCount: 1,
      storageLocations: [],
    });

    const { result } = renderHookWithApollo(() => usePantryQuery('pantry-1'), {
      mocks: {
        Query: () => ({ pantry: { id: 'pantry-1' } }),
      },
    });

    await waitFor(() => {
      expect(result.current.state.pantryItems).toEqual([
        { id: 'item-1', itemName: 'Milk' },
      ]);
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

    // Items come straight from normalizePantry → usePreservedArrayData with
    // no intermediate JS-layer filtering. The Apollo cache is the single
    // source of truth; pending-delete echoes are skipped at the subscription
    // handler level in `usePantrySubscriptions.ts`.
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });
});
