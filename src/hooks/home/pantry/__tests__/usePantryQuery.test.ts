'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePantryQuery } from '../usePantryQuery';

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

const mockRefetch = jest.fn().mockResolvedValue({});
const mockFetchMore = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetPantryQuery: jest.fn(() => ({
    data: null,
    loading: false,
    error: undefined,
    refetch: mockRefetch,
    fetchMore: mockFetchMore,
  })),
}));

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
    const { result } = renderHook(() => usePantryQuery(undefined));

    expect(result.current.state.pantryItems).toEqual([]);
    expect(result.current.state.loading).toBe(false);
  });

  it('skips query when pantryId is empty string', () => {
    const { useGetPantryQuery } = require('#generated');

    renderHook(() => usePantryQuery(''));

    expect(useGetPantryQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    );
  });

  it('executes query when pantryId is valid', () => {
    const { useGetPantryQuery } = require('#generated');

    renderHook(() => usePantryQuery('pantry-1'));

    expect(useGetPantryQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: false,
        variables: expect.objectContaining({ id: 'pantry-1' }),
      }),
    );
  });

  it('returns normalized pantry items from query data', () => {
    const { useGetPantryQuery } = require('#generated');
    const { normalizePantry } = require('#/utils/connectionUtils');

    normalizePantry.mockReturnValue({
      items: [{ id: 'item-1', itemName: 'Milk' }],
      itemsPageInfo: null,
      stats: { totalItems: 1 },
      itemsTotalCount: 1,
    });

    useGetPantryQuery.mockReturnValue({
      data: { pantry: { id: 'pantry-1' } },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
      fetchMore: mockFetchMore,
    });

    const { result } = renderHook(() => usePantryQuery('pantry-1'));

    expect(result.current.state.pantryItems).toEqual([
      { id: 'item-1', itemName: 'Milk' },
    ]);
    expect(result.current.state.totalCount).toBe(1);
  });

  it('passes itemsOrderBy to query variables', () => {
    const { useGetPantryQuery, SortOrder } = require('#generated');
    const orderBy = { itemName: SortOrder.Asc };

    renderHook(() => usePantryQuery('pantry-1', null, orderBy));

    expect(useGetPantryQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ itemsOrderBy: orderBy }),
      }),
    );
  });

  it('passes itemsFirst as 20 (PAGE_SIZE.DEFAULT)', () => {
    const { useGetPantryQuery } = require('#generated');

    renderHook(() => usePantryQuery('pantry-1'));

    expect(useGetPantryQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: expect.objectContaining({ itemsFirst: 20 }),
      }),
    );
  });

  it('provides refetch that tracks refreshing state', async () => {
    const { result } = renderHook(() => usePantryQuery('pantry-1'));

    await act(async () => {
      await result.current.actions.refetch();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('signals pantry query complete when not loading and valid pantryId', () => {
    const { useGetPantryQuery } = require('#generated');
    useGetPantryQuery.mockReturnValue({
      data: { pantry: { id: 'pantry-1' } },
      loading: false,
      error: undefined,
      refetch: mockRefetch,
      fetchMore: mockFetchMore,
    });

    renderHook(() => usePantryQuery('pantry-1'));

    expect(mockSetIsPantryQueryComplete).toHaveBeenCalledWith(true);
  });

  it('resets pantry query complete when pantryId becomes invalid', () => {
    renderHook(() => usePantryQuery(undefined));

    expect(mockSetIsPantryQueryComplete).toHaveBeenCalledWith(false);
  });

  it('returns pagination helpers', () => {
    const { result } = renderHook(() => usePantryQuery('pantry-1'));

    expect(result.current.state.hasMore).toBe(false);
    expect(typeof result.current.actions.loadMore).toBe('function');
    expect(result.current.state.isLoadingMore).toBe(false);
  });

  it('returns items directly from the cache (pending-delete filtering now happens in subscription handlers)', () => {
    const { result } = renderHook(() => usePantryQuery('pantry-1'));

    // Items come straight from normalizePantry → usePreservedArrayData with
    // no intermediate JS-layer filtering. The Apollo cache is the single
    // source of truth; pending-delete echoes are skipped at the subscription
    // handler level in `usePantrySubscriptions.ts`.
    expect(Array.isArray(result.current.state.pantryItems)).toBe(true);
  });
});
