import { renderHook } from '@testing-library/react-native';
import { useShoppingListQuery } from '../../../src/hooks/shoppingList/useShoppingListQuery';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';

// Mock dependencies
jest.mock('#generated', () => ({
  useGetShoppingListItemsQuery: jest.fn(),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('#/apollo/policies/offlineFetchPolicies', () => ({
  useOfflineAwareFetchPolicy: jest.fn(),
  OFFLINE_FETCH_POLICIES: {
    LIST: {
      online: 'cache-and-network',
      offline: 'cache-only',
    },
  },
}));

import { useGetShoppingListItemsQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useOfflineAwareFetchPolicy } from '#/apollo/policies/offlineFetchPolicies';

const mockUseGetShoppingListItemsQuery = useGetShoppingListItemsQuery as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseOfflineAwareFetchPolicy = useOfflineAwareFetchPolicy as jest.Mock;

// Helper to create mock items
const createMockItem = (
  id: string,
  itemName: string,
  overrides?: Partial<ShoppingListItemCoreFragment>,
): ShoppingListItemCoreFragment =>
  ({
    __typename: 'ShoppingListItem',
    id,
    itemName,
    quantity: 1,
    isPurchased: false,
    updatedAt: new Date().toISOString(),
    version: 1,
    unit: null,
    displayFormat: 'DECIMAL',
    shoppingList: {
      __typename: 'ShoppingList',
      id: 'list-1',
    },
    pantryItem: null,
    ...overrides,
  }) as unknown as ShoppingListItemCoreFragment;

describe('useShoppingListQuery', () => {
  const mockListId = 'list-123';
  const mockRefetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockUseAuth.mockReturnValue({ isLoggedOut: false });
    mockUseOfflineAwareFetchPolicy.mockReturnValue('cache-and-network');
  });

  describe('successful data fetching', () => {
    it('returns items when query succeeds', () => {
      const mockItems = [
        createMockItem('1', 'Milk'),
        createMockItem('2', 'Bread'),
      ];

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: mockItems },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toEqual(mockItems);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.refetch).toBe(mockRefetch);
    });

    it('returns empty array when no items', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('returns empty array when data is undefined', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toEqual([]);
    });

    it('returns empty array when shoppingListItems is null', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toEqual([]);
    });
  });

  describe('loading states', () => {
    it('returns loading state correctly', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);
    });

    it('transitions from loading to loaded', () => {
      const mockItems = [createMockItem('1', 'Milk')];

      mockUseGetShoppingListItemsQuery.mockReturnValueOnce({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(
        (props: { listId: string }) => useShoppingListQuery(props.listId),
        { initialProps: { listId: mockListId } },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);

      // Update mock to simulate data loaded
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: mockItems },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      rerender({ listId: mockListId });

      expect(result.current.loading).toBe(false);
      expect(result.current.items).toEqual(mockItems);
    });
  });

  describe('error handling', () => {
    it('returns error when query fails', () => {
      const mockError = new Error('Network error');

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.error).toBe(mockError);
      expect(result.current.items).toEqual([]);
    });

    it('can have both error and partial data (errorPolicy: all)', () => {
      const mockItems = [createMockItem('1', 'Milk')];
      const mockError = new Error('Partial failure');

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: mockItems },
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.error).toBe(mockError);
      expect(result.current.items).toEqual(mockItems);
    });
  });

  describe('skip conditions', () => {
    it('skips query when listId is undefined', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(undefined));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('skips query when user is logged out', () => {
      mockUseAuth.mockReturnValue({ isLoggedOut: true });

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('does not skip when listId exists and user is logged in', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
        }),
      );
    });
  });

  describe('query configuration', () => {
    it('passes correct variables to query', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            shoppingListId: mockListId,
          },
        }),
      );
    });

    it('uses offline-aware fetch policy', () => {
      const mockFetchPolicy = 'cache-first';
      mockUseOfflineAwareFetchPolicy.mockReturnValue(mockFetchPolicy);

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseOfflineAwareFetchPolicy).toHaveBeenCalledWith(
        'cache-and-network',
        'cache-only',
      );

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchPolicy: mockFetchPolicy,
        }),
      );
    });

    it('sets notifyOnNetworkStatusChange to true', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyOnNetworkStatusChange: true,
        }),
      );
    });

    it('sets errorPolicy to all', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });
  });

  describe('memoization', () => {
    it('memoizes items when data reference unchanged', () => {
      const mockItems = [createMockItem('1', 'Milk')];

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: mockItems },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(
        (props: { listId: string }) => useShoppingListQuery(props.listId),
        { initialProps: { listId: mockListId } },
      );

      const firstItems = result.current.items;
      rerender({ listId: mockListId });
      const secondItems = result.current.items;

      expect(firstItems).toBe(secondItems); // Same reference
    });

    it('recalculates items when data changes', () => {
      const mockItems1 = [createMockItem('1', 'Milk')];
      const mockItems2 = [createMockItem('2', 'Bread')];

      mockUseGetShoppingListItemsQuery.mockReturnValueOnce({
        data: { shoppingListItems: mockItems1 },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(
        (props: { listId: string }) => useShoppingListQuery(props.listId),
        { initialProps: { listId: mockListId } },
      );

      const firstItems = result.current.items;
      expect(firstItems).toEqual(mockItems1);

      // Update mock to return different data
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: mockItems2 },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      rerender({ listId: mockListId });

      const secondItems = result.current.items;
      expect(secondItems).toEqual(mockItems2);
      expect(firstItems).not.toBe(secondItems); // Different reference
    });
  });

  describe('edge cases', () => {
    it('handles empty string listId', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(''));

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true, // Empty string is falsy
        }),
      );
    });

    it('handles listId change', () => {
      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: [] },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { rerender } = renderHook(
        (props: { listId: string }) => useShoppingListQuery(props.listId),
        { initialProps: { listId: 'list-1' } },
      );

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { shoppingListId: 'list-1' },
        }),
      );

      rerender({ listId: 'list-2' });

      expect(mockUseGetShoppingListItemsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { shoppingListId: 'list-2' },
        }),
      );
    });

    it('handles very large item lists', () => {
      const mockItems = Array(10000)
        .fill(null)
        .map((_, i) => createMockItem(`item-${i}`, `Item ${i}`));

      mockUseGetShoppingListItemsQuery.mockReturnValue({
        data: { shoppingListItems: mockItems },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toHaveLength(10000);
    });
  });
});
