'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePaginatedShoppingItems } from '../usePaginatedShoppingItems';

jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockFetchMore = jest.fn();
const mockRefetch = jest.fn();

jest.mock('#generated', () => ({
  useGetShoppingListItemsPaginatedQuery: jest.fn(() => ({
    data: null,
    previousData: null,
    loading: false,
    error: undefined,
    fetchMore: mockFetchMore,
    refetch: mockRefetch,
  })),
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
  executeRefetch: jest.fn(async (fn: () => Promise<any>) => { await fn(); }),
  executeMutationWithErrorHandler: jest.fn(async (fn: () => Promise<any>, onError?: (e: any) => void) => {
    try {
      return await fn();
    } catch (e) {
      if (onError) onError(e);
      return false;
    }
  }),
}));

// Mock requestIdleCallback/cancelIdleCallback
(global as any).requestIdleCallback = jest.fn((cb: any) => { cb(); return 1; });
(global as any).cancelIdleCallback = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('usePaginatedShoppingItems', () => {
  it('returns empty items when no data', () => {
    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.unpurchased.items).toEqual([]);
    expect(result.current.purchased.items).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('skips query when listId is null', () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');

    renderHook(() => usePaginatedShoppingItems({ listId: null }));

    expect(useGetShoppingListItemsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    );
  });

  it('skips query when skip option is true', () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');

    renderHook(() => usePaginatedShoppingItems({ listId: 'list-1', skip: true }));

    expect(useGetShoppingListItemsPaginatedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ skip: true }),
    );
  });

  it('extracts and sorts unpurchased items', () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');
    useGetShoppingListItemsPaginatedQuery.mockReturnValue({
      data: {
        shoppingList: {
          unpurchasedItems: {
            edges: [
              { node: { id: '2', itemName: 'Bread', sortOrder: 'b' } },
              { node: { id: '1', itemName: 'Milk', sortOrder: 'a' } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 2,
          },
          purchasedItems: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 0,
          },
        },
      },
      previousData: null,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.unpurchased.items).toHaveLength(2);
    expect(result.current.unpurchased.items[0].id).toBe('1');
    expect(result.current.unpurchased.items[1].id).toBe('2');
  });

  it('filters out items with missing id or itemName', () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');
    useGetShoppingListItemsPaginatedQuery.mockReturnValue({
      data: {
        shoppingList: {
          unpurchasedItems: {
            edges: [
              { node: { id: '1', itemName: 'Milk', sortOrder: 'a' } },
              { node: { id: null, itemName: 'Bad', sortOrder: 'b' } },
              { node: { id: '3', itemName: '', sortOrder: 'c' } },
            ],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 3,
          },
          purchasedItems: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 0,
          },
        },
      },
      previousData: null,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.unpurchased.items).toHaveLength(1);
    expect(result.current.unpurchased.items[0].id).toBe('1');
  });

  it('exposes hasMore and totalCount for unpurchased', () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');
    useGetShoppingListItemsPaginatedQuery.mockReturnValue({
      data: {
        shoppingList: {
          unpurchasedItems: {
            edges: [{ node: { id: '1', itemName: 'Milk', sortOrder: 'a' } }],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
            totalCount: 50,
          },
          purchasedItems: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 0,
          },
        },
      },
      previousData: null,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    expect(result.current.unpurchased.hasMore).toBe(true);
    expect(result.current.unpurchased.totalCount).toBe(50);
  });

  it('loadMoreUnpurchased calls fetchMore', async () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');
    mockFetchMore.mockResolvedValue({});
    useGetShoppingListItemsPaginatedQuery.mockReturnValue({
      data: {
        shoppingList: {
          unpurchasedItems: {
            edges: [{ node: { id: '1', itemName: 'Milk', sortOrder: 'a' } }],
            pageInfo: { hasNextPage: true, endCursor: 'cursor-1' },
            totalCount: 50,
          },
          purchasedItems: {
            edges: [],
            pageInfo: { hasNextPage: false, endCursor: null },
            totalCount: 0,
          },
        },
      },
      previousData: null,
      loading: false,
      error: undefined,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    await act(async () => {
      await result.current.unpurchased.loadMore();
    });

    expect(mockFetchMore).toHaveBeenCalledWith({
      variables: { unpurchasedAfter: 'cursor-1' },
    });
  });

  it('refetch wraps with error handling', async () => {
    mockRefetch.mockResolvedValue({});
    const { result } = renderHook(() =>
      usePaginatedShoppingItems({ listId: 'list-1' }),
    );

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });

  it('returns isTransitioning false when listId is stable', () => {
    const { useGetShoppingListItemsPaginatedQuery } = require('#generated');
    useGetShoppingListItemsPaginatedQuery.mockReturnValue({
      data: null,
      previousData: null,
      loading: true,
      error: undefined,
      fetchMore: mockFetchMore,
      refetch: mockRefetch,
    });

    const { result } = renderHook(
      ({ listId }: { listId: string }) => usePaginatedShoppingItems({ listId }),
      { initialProps: { listId: 'list-1' } },
    );

    // With a stable listId, isTransitioning should be false
    expect(result.current.isTransitioning).toBe(false);
  });
});
