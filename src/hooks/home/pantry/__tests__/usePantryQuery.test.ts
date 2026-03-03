'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePantryQuery } from '../usePantryQuery';

jest.mock('../../../../apollo/links/tokenScheduler');
jest.mock('../../../../apollo/links/refreshToken');

const mockRefetch = jest.fn().mockResolvedValue({});
const mockFetchMore = jest.fn();

jest.mock('#generated', () => ({
  useGetPantryQuery: jest.fn(() => ({
    data: null,
    loading: false,
    error: undefined,
    refetch: mockRefetch,
    fetchMore: mockFetchMore,
  })),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({ isLoggedOut: false }),
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

jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    filterPendingDeletes: jest.fn((items: any[]) => items),
  },
}));

jest.mock('#/hooks/apollo/usePreservedQueryData', () => ({
  usePreservedArrayData: (data: any) => data || [],
}));

jest.mock('../../../useSearchableList', () => ({
  useSearchableList: jest.fn((items: any[]) => ({
    query: '',
    setQuery: jest.fn(),
    filtered: items,
  })),
}));

jest.mock('#/utils/searchUtils', () => ({
  pantryItemSearch: jest.fn(),
}));

const mockSetIsPantryQueryComplete = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) =>
    selector({
      isHomeSelectionReady: true,
      setIsPantryQueryComplete: mockSetIsPantryQueryComplete,
    }),
  ),
  selectIsHomeSelectionReady: (s: any) => s.isHomeSelectionReady,
  selectSetIsPantryQueryComplete: (s: any) => s.setIsPantryQueryComplete,
}));

(global as any).requestIdleCallback = jest.fn((cb: any) => { cb(); return 1; });
(global as any).cancelIdleCallback = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePantryQuery', () => {
  it('returns empty items when no pantryId', () => {
    const { result } = renderHook(() => usePantryQuery(undefined));

    expect(result.current.pantryItems).toEqual([]);
    expect(result.current.loading).toBe(false);
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

    expect(result.current.pantryItems).toEqual([{ id: 'item-1', itemName: 'Milk' }]);
    expect(result.current.totalCount).toBe(1);
  });

  it('exposes search query and setter', () => {
    const { result } = renderHook(() => usePantryQuery('pantry-1'));

    expect(result.current.searchQuery).toBe('');
    expect(typeof result.current.setSearchQuery).toBe('function');
  });

  it('provides refetch that tracks refreshing state', async () => {
    const { result } = renderHook(() => usePantryQuery('pantry-1'));

    await act(async () => {
      await result.current.refetch();
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

    expect(result.current.hasMore).toBe(false);
    expect(typeof result.current.loadMore).toBe('function');
    expect(result.current.isLoadingMore).toBe(false);
  });

  it('filters pending deletes from items', () => {
    const { subscriptionService } = require('#/services/subscriptions/SubscriptionService');
    subscriptionService.filterPendingDeletes.mockReturnValue([]);

    renderHook(() => usePantryQuery('pantry-1'));

    expect(subscriptionService.filterPendingDeletes).toHaveBeenCalled();
  });
});
