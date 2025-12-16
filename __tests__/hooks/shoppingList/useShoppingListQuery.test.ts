import { renderHook } from '@testing-library/react-native';
import { useShoppingListQuery } from '../../../src/hooks/shoppingList/useShoppingListQuery';
import type { ShoppingListItemCoreFragment } from '#/graphql/generated/types';

// Mock dependencies
jest.mock('#generated', () => ({
  useGetShoppingListQuery: jest.fn(),
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

import { useGetShoppingListQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useOfflineAwareFetchPolicy } from '#/apollo/policies/offlineFetchPolicies';

const mockUseGetShoppingListQuery = useGetShoppingListQuery as jest.Mock;
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
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
      purchasedQuantity: null,
      purchasedPrice: null,
      purchaseDate: null,
      purchasedBy: null,
    },
    sortOrder: 'a0',
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

// Helper to create connection response structure
const createConnectionResponse = (items: ShoppingListItemCoreFragment[]) => ({
  shoppingList: {
    __typename: 'ShoppingList',
    itemsConnection: {
      __typename: 'ShoppingListItemConnection',
      edges: items.map(item => ({
        __typename: 'ShoppingListItemEdge',
        node: item,
        cursor: item.id,
      })),
      pageInfo: {
        hasNextPage: false,
        endCursor: items.length > 0 ? items[items.length - 1].id : null,
      },
      totalCount: items.length,
    },
  },
});

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

      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].itemName).toBe('Milk');
      expect(result.current.items[1].itemName).toBe('Bread');
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.refetch).toBe(mockRefetch);
    });

    it('returns empty array when no items', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it('returns empty array when data is undefined', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toEqual([]);
    });

    it('returns empty array when shoppingList is null', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: { shoppingList: null },
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
      mockUseGetShoppingListQuery.mockReturnValue({
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

      mockUseGetShoppingListQuery.mockReturnValueOnce({
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
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      rerender({ listId: mockListId });

      expect(result.current.loading).toBe(false);
      expect(result.current.items).toHaveLength(1);
    });
  });

  describe('error handling', () => {
    it('returns error when query fails', () => {
      const mockError = new Error('Network error');

      mockUseGetShoppingListQuery.mockReturnValue({
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

      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems),
        loading: false,
        error: mockError,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.error).toBe(mockError);
      expect(result.current.items).toHaveLength(1);
    });
  });

  describe('skip conditions', () => {
    it('skips query when listId is undefined', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(undefined));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('skips query when user is logged out', () => {
      mockUseAuth.mockReturnValue({ isLoggedOut: true });

      mockUseGetShoppingListQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('does not skip when listId exists and user is logged in', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
        }),
      );
    });
  });

  describe('query configuration', () => {
    it('passes correct variables to query', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            id: mockListId,
          },
        }),
      );
    });

    it('uses offline-aware fetch policy', () => {
      const mockFetchPolicy = 'cache-first';
      mockUseOfflineAwareFetchPolicy.mockReturnValue(mockFetchPolicy);

      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseOfflineAwareFetchPolicy).toHaveBeenCalledWith(
        'cache-and-network',
        'cache-only',
      );

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchPolicy: mockFetchPolicy,
        }),
      );
    });

    it('sets notifyOnNetworkStatusChange to true', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyOnNetworkStatusChange: true,
        }),
      );
    });

    it('sets errorPolicy to all', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(mockListId));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'all',
        }),
      );
    });
  });

  describe('sorting', () => {
    it('sorts items by isPurchased (unpurchased first) then sortOrder', () => {
      const mockItems = [
        createMockItem('1', 'Purchased Item', {
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: true,
            purchasedQuantity: null,
            purchasedPrice: null,
            purchaseDate: null,
            purchasedBy: null,
          },
          sortOrder: 'a0',
        }),
        createMockItem('2', 'Unpurchased B', {
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
            purchasedQuantity: null,
            purchasedPrice: null,
            purchaseDate: null,
            purchasedBy: null,
          },
          sortOrder: 'b0',
        }),
        createMockItem('3', 'Unpurchased A', {
          purchaseInfo: {
            __typename: 'ShoppingListItemPurchaseInfo',
            isPurchased: false,
            purchasedQuantity: null,
            purchasedPrice: null,
            purchaseDate: null,
            purchasedBy: null,
          },
          sortOrder: 'a0',
        }),
      ];

      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      // Unpurchased items should come first, sorted by sortOrder
      expect(result.current.items[0].itemName).toBe('Unpurchased A');
      expect(result.current.items[1].itemName).toBe('Unpurchased B');
      // Purchased items come last
      expect(result.current.items[2].itemName).toBe('Purchased Item');
    });
  });

  describe('memoization', () => {
    it('memoizes items when data reference unchanged', () => {
      const mockItems = [createMockItem('1', 'Milk')];

      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems),
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

      mockUseGetShoppingListQuery.mockReturnValueOnce({
        data: createConnectionResponse(mockItems1),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result, rerender } = renderHook(
        (props: { listId: string }) => useShoppingListQuery(props.listId),
        { initialProps: { listId: mockListId } },
      );

      const firstItems = result.current.items;
      expect(firstItems[0].itemName).toBe('Milk');

      // Update mock to return different data
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems2),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      rerender({ listId: mockListId });

      const secondItems = result.current.items;
      expect(secondItems[0].itemName).toBe('Bread');
      expect(firstItems).not.toBe(secondItems); // Different reference
    });
  });

  describe('edge cases', () => {
    it('handles empty string listId', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      renderHook(() => useShoppingListQuery(''));

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true, // Empty string is falsy
        }),
      );
    });

    it('handles listId change', () => {
      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse([]),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { rerender } = renderHook(
        (props: { listId: string }) => useShoppingListQuery(props.listId),
        { initialProps: { listId: 'list-1' } },
      );

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'list-1' },
        }),
      );

      rerender({ listId: 'list-2' });

      expect(mockUseGetShoppingListQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'list-2' },
        }),
      );
    });

    it('handles very large item lists', () => {
      const mockItems = Array(10000)
        .fill(null)
        .map((_, i) => createMockItem(`item-${i}`, `Item ${i}`));

      mockUseGetShoppingListQuery.mockReturnValue({
        data: createConnectionResponse(mockItems),
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      });

      const { result } = renderHook(() => useShoppingListQuery(mockListId));

      expect(result.current.items).toHaveLength(10000);
    });
  });
});
