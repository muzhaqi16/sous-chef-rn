'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePaginatedShoppingItems } from '../usePaginatedShoppingItems';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockUnpurchasedFetchMore = jest.fn();
const mockPurchasedFetchMore = jest.fn();
const mockUnpurchasedRefetch = jest.fn();
const mockPurchasedRefetch = jest.fn();

// Default return values per isPurchased filter
let mockUnpurchasedReturn: Record<string, any> = {
  data: null,
  previousData: null,
  loading: false,
  error: undefined,
  fetchMore: mockUnpurchasedFetchMore,
  refetch: mockUnpurchasedRefetch,
};
let mockPurchasedReturn: Record<string, any> = {
  data: null,
  previousData: null,
  loading: false,
  error: undefined,
  fetchMore: mockPurchasedFetchMore,
  refetch: mockPurchasedRefetch,
};

jest.mock('#generated', () => ({
  useGetShoppingListItemsFilteredQuery: jest.fn((options: any) => {
    if (options?.variables?.isPurchased === false) return mockUnpurchasedReturn;
    return mockPurchasedReturn;
  }),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({ isLoggedOut: false }),
}));

jest.mock('#/constants/shoppingList', () => ({
  PAGINATION: { ITEMS_PAGE_SIZE: 25 },
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeRefetch: jest.fn((fn: any) => fn()),
  executeMutation: jest.fn((fn: any) => fn()),
}));

jest.mock('#hooks/utils/usePagination', () => ({
  usePagination: jest.fn((config: any) => ({
    hasMore: config.pageInfo?.hasNextPage ?? false,
    endCursor: config.pageInfo?.endCursor ?? null,
    loadMore: jest.fn(),
    isLoadingMore: false,
    loadMoreError: false,
  })),
}));

// Mock requestIdleCallback/cancelIdleCallback
(global as any).requestIdleCallback = jest.fn((cb: any) => {
  cb();
  return 1;
});
(global as any).cancelIdleCallback = jest.fn();

/** Helper to build a mock connection data shape */
function buildConnectionData(
  edges: Array<{ id: string; itemName: string; sortOrder: string }>,
  pageInfo = { hasNextPage: false, endCursor: null as string | null },
  totalCount?: number,
) {
  return {
    shoppingList: {
      itemsConnection: {
        edges: edges.map(node => ({ cursor: `cursor-${node.id}`, node })),
        pageInfo,
        totalCount: totalCount ?? edges.length,
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUnpurchasedReturn = {
    data: null,
    previousData: null,
    loading: false,
    error: undefined,
    fetchMore: mockUnpurchasedFetchMore,
    refetch: mockUnpurchasedRefetch,
  };
  mockPurchasedReturn = {
    data: null,
    previousData: null,
    loading: false,
    error: undefined,
    fetchMore: mockPurchasedFetchMore,
    refetch: mockPurchasedRefetch,
  };
});

describe('usePaginatedShoppingItems', () => {
  it('returns empty items when no data', () => {
    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.state.unpurchased.items).toEqual([]);
    expect(result.current.state.purchased.items).toEqual([]);
    expect(result.current.state.loading).toBe(false);
  });

  it('skips queries when listId is null', () => {
    const { useGetShoppingListItemsFilteredQuery } = require('#generated');

    renderHook(() => usePaginatedShoppingItems({ listId: null }));

    // Called twice (once per tab), both should have skip: true
    const calls = useGetShoppingListItemsFilteredQuery.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual(expect.objectContaining({ skip: true }));
    expect(calls[1][0]).toEqual(expect.objectContaining({ skip: true }));
  });

  it('skips queries when skip option is true', () => {
    const { useGetShoppingListItemsFilteredQuery } = require('#generated');

    renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1', skip: true }),
    );

    const calls = useGetShoppingListItemsFilteredQuery.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0][0]).toEqual(expect.objectContaining({ skip: true }));
    expect(calls[1][0]).toEqual(expect.objectContaining({ skip: true }));
  });

  it('passes correct isPurchased variable to each query', () => {
    const { useGetShoppingListItemsFilteredQuery } = require('#generated');

    renderHook(() => usePaginatedShoppingItems({ listId: 'list-1' }));

    const calls = useGetShoppingListItemsFilteredQuery.mock.calls;
    expect(calls[0][0].variables).toEqual(
      expect.objectContaining({ isPurchased: false }),
    );
    expect(calls[1][0].variables).toEqual(
      expect.objectContaining({ isPurchased: true }),
    );
  });

  it('extracts unpurchased items in edge order', () => {
    mockUnpurchasedReturn.data = buildConnectionData([
      { id: '2', itemName: 'Bread', sortOrder: 'b' },
      { id: '1', itemName: 'Milk', sortOrder: 'a' },
    ]);

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.state.unpurchased.items).toHaveLength(2);
    // Items preserved in edge order (cache insertion order), not sorted by sortOrder
    expect(result.current.state.unpurchased.items[0].id).toBe('2');
    expect(result.current.state.unpurchased.items[1].id).toBe('1');
  });

  it('filters out items with missing id or itemName', () => {
    mockUnpurchasedReturn.data = buildConnectionData([
      { id: '1', itemName: 'Milk', sortOrder: 'a' },
      { id: null as any, itemName: 'Bad', sortOrder: 'b' },
      { id: '3', itemName: '', sortOrder: 'c' },
    ]);

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.state.unpurchased.items).toHaveLength(1);
    expect(result.current.state.unpurchased.items[0].id).toBe('1');
  });

  it('exposes hasMore and totalCount for unpurchased', () => {
    mockUnpurchasedReturn.data = buildConnectionData(
      [{ id: '1', itemName: 'Milk', sortOrder: 'a' }],
      { hasNextPage: true, endCursor: 'cursor-1' },
      50,
    );

    const { usePagination } = require('#hooks/utils/usePagination');
    usePagination.mockImplementation((config: any) => ({
      hasMore: config.pageInfo?.hasNextPage ?? false,
      endCursor: config.pageInfo?.endCursor ?? null,
      loadMore: jest.fn(),
      isLoadingMore: false,
      loadMoreError: false,
    }));

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.state.unpurchased.hasMore).toBe(true);
    expect(result.current.state.unpurchased.totalCount).toBe(50);
  });

  it('delegates loadMore to usePagination', () => {
    const mockLoadMore = jest.fn();
    const { usePagination } = require('#hooks/utils/usePagination');
    usePagination.mockImplementation((config: any) => ({
      hasMore: config.pageInfo?.hasNextPage ?? false,
      endCursor: config.pageInfo?.endCursor ?? null,
      loadMore: mockLoadMore,
      isLoadingMore: false,
      loadMoreError: false,
    }));

    mockUnpurchasedReturn.data = buildConnectionData(
      [{ id: '1', itemName: 'Milk', sortOrder: 'a' }],
      { hasNextPage: true, endCursor: 'cursor-1' },
      50,
    );

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    result.current.state.unpurchased.loadMore();
    expect(mockLoadMore).toHaveBeenCalled();
  });

  it('refetch calls both query refetch functions', async () => {
    mockUnpurchasedRefetch.mockResolvedValue({});
    mockPurchasedRefetch.mockResolvedValue({});

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    await act(async () => {
      await result.current.actions.refetch();
    });

    expect(mockUnpurchasedRefetch).toHaveBeenCalled();
    expect(mockPurchasedRefetch).toHaveBeenCalled();
  });

  it('returns isTransitioning false when listId is stable', () => {
    mockUnpurchasedReturn.loading = true;
    mockPurchasedReturn.loading = true;

    const { result } = renderHook(
      ({ listId }: { listId: string }) => usePaginatedShoppingItems({ listId }),
      { initialProps: { listId: 'list-1' } },
    );

    expect(result.current.state.isTransitioning).toBe(false);
  });

  it('combines errors from both queries', () => {
    const testError = new Error('Network error');
    mockUnpurchasedReturn.error = testError;

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.state.error).toBe(testError);
  });

  it('returns purchased items independently from unpurchased', () => {
    mockPurchasedReturn.data = buildConnectionData([
      { id: '10', itemName: 'Eggs', sortOrder: 'a' },
      { id: '11', itemName: 'Butter', sortOrder: 'b' },
    ]);

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.state.purchased.items).toHaveLength(2);
    expect(result.current.state.unpurchased.items).toHaveLength(0);
  });
});
