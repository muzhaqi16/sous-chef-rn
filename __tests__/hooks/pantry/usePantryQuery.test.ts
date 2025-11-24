import { renderHook } from '@testing-library/react-native';
import { usePantryQuery } from '../../../src/hooks/pantry/usePantryQuery';
import type { PantryItem } from '#/graphql/generated/types';

// Mock dependencies
jest.mock('react-native-config', () => ({
  API_URL: 'http://localhost:4000',
  ENABLE_OFFLINE_MODE: 'true',
}));

// Mock Apollo client to prevent initialization and resource creation
jest.mock('#/apollo/client', () => ({
  client: {
    cache: {
      write: jest.fn(),
      evict: jest.fn(),
      modify: jest.fn(),
      extract: jest.fn(() => ({})),
      restore: jest.fn(),
    },
    onResetStore: jest.fn(() => Promise.resolve()),
    onClearStore: jest.fn(() => Promise.resolve()),
  },
  cancelCachePersistence: jest.fn(),
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  })),
  createMMKV: jest.fn().mockReturnValue({
    set: jest.fn(),
    getString: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    clearAll: jest.fn(),
  }),
}));

jest.mock('#generated', () => ({
  useGetPantryQuery: jest.fn(),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizePantry: jest.fn(),
}));

// Mock the entire offline queue module to avoid dynamic import
jest.mock('#/apollo/offlineQueue', () => ({
  offlineQueueManager: {
    enqueue: jest.fn(),
    processQueue: jest.fn(),
    clearQueue: jest.fn(),
  },
  createQueueLink: jest.fn(() => ({ request: (operation: any, forward: any) => forward(operation) })),
}));

// Mock WebSocket to prevent connection
jest.mock('#/apollo/links/wsLink', () => ({
  wsLink: {},
  reconnectWebSocket: jest.fn(),
  disposeWebSocket: jest.fn(),
  isWebSocketReconnecting: jest.fn(() => false),
  getWebSocketState: jest.fn(() => ({ isReconnecting: false, lastReconnectTime: 0, hasClient: false })),
}));

// Mock token scheduler to prevent timer creation
jest.mock('#/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelTokenRefresh: jest.fn(),
  getScheduleState: jest.fn(() => ({ isScheduled: false })),
}));

import { useGetPantryQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { normalizePantry } from '#/utils/connectionUtils';

const mockUseGetPantryQuery = useGetPantryQuery as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockNormalizePantry = normalizePantry as jest.Mock;

// Helper to create mock pantry items
const createMockPantryItem = (
  id: string,
  itemName: string,
): PantryItem => ({
  __typename: 'PantryItem',
  id,
  itemName,
  currentQuantity: 5,
  storageState: 'FRESH',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  version: 1,
  storageLocation: null,
  storageNotes: null,
  expiresAt: null,
  autoReorderPoint: null,
  pantry: {
    __typename: 'Pantry',
    id: 'pantry-1',
  },
  unit: null,
} as PantryItem);

describe('usePantryQuery', () => {
  const mockPantryId = 'pantry-123';
  const mockRefetch = jest.fn();
  const mockFetchMore = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mocks
    mockUseAuth.mockReturnValue({ isLoggedOut: false });
  });

  afterAll(() => {
    // Clean up timers to allow Jest to exit cleanly
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  describe('successful data fetching', () => {
    it('returns normalized items when query succeeds', () => {
      const mockItems = [
        createMockPantryItem('1', 'Milk'),
        createMockPantryItem('2', 'Bread'),
      ];

      const mockPageInfo = {
        hasNextPage: true,
        endCursor: 'cursor-123',
      };

      const mockPantryData = {
        id: mockPantryId,
        itemsConnection: {
          edges: mockItems.map(item => ({ node: item })),
          pageInfo: mockPageInfo,
        },
      };

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: mockPantryData },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: mockItems,
        itemsPageInfo: mockPageInfo,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.items).toEqual(mockItems);
      expect(result.current.pageInfo).toEqual(mockPageInfo);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeUndefined();
      expect(result.current.refetch).toBe(mockRefetch);
      expect(result.current.fetchMore).toBe(mockFetchMore);
    });

    it('returns empty array when no items', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.items).toEqual([]);
      expect(result.current.pageInfo).toBeUndefined();
    });

    it('calls normalizePantry with pantry data', () => {
      const mockPantryData = {
        id: mockPantryId,
        itemsConnection: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      };

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: mockPantryData },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: { hasNextPage: false, endCursor: null },
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockNormalizePantry).toHaveBeenCalledWith(mockPantryData);
    });
  });

  describe('loading states', () => {
    it('returns loading state correctly', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);
    });

    it('transitions from loading to loaded', () => {
      const mockItems = [createMockPantryItem('1', 'Milk')];

      mockUseGetPantryQuery.mockReturnValueOnce({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result, rerender } = renderHook(() =>
        usePantryQuery(mockPantryId),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);

      // Update mock to simulate data loaded
      const mockPageInfo = { hasNextPage: false, endCursor: null };
      mockUseGetPantryQuery.mockReturnValue({
        data: {
          pantry: {
            id: mockPantryId,
            itemsConnection: {
              edges: mockItems.map(item => ({ node: item })),
              pageInfo: mockPageInfo,
            },
          },
        },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: mockItems,
        itemsPageInfo: mockPageInfo,
      });

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.items).toEqual(mockItems);
    });
  });

  describe('error handling', () => {
    it('returns error when query fails', () => {
      const mockError = new Error('Network error');

      mockUseGetPantryQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: mockError,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.error).toBe(mockError);
      expect(result.current.items).toEqual([]);
    });
  });

  describe('skip conditions', () => {
    it('skips query when pantryId is undefined', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(undefined));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('skips query when user is logged out', () => {
      mockUseAuth.mockReturnValue({ isLoggedOut: true });

      mockUseGetPantryQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true,
        }),
      );
    });

    it('does not skip when pantryId exists and user is logged in', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: false,
        }),
      );
    });
  });

  describe('query configuration', () => {
    it('passes correct variables to query', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: {
            id: mockPantryId,
            itemsFirst: 25,
            storageLocationsFirst: 50,
          },
        }),
      );
    });

    it('uses cache-and-network fetch policy', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          fetchPolicy: 'cache-and-network',
        }),
      );
    });

    it('sets notifyOnNetworkStatusChange to true', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyOnNetworkStatusChange: true,
        }),
      );
    });

    it('sets errorPolicy to ignore for better offline handling', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          errorPolicy: 'ignore',
        }),
      );
    });

    it('sets initial page size to 25 items', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(mockPantryId));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            itemsFirst: 25,
          }),
        }),
      );
    });
  });

  describe('pagination support', () => {
    it('returns pageInfo for pagination', () => {
      const mockPageInfo = {
        hasNextPage: true,
        endCursor: 'cursor-abc',
      };

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: { itemsConnection: { edges: [], pageInfo: mockPageInfo } } },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: mockPageInfo,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.pageInfo).toEqual(mockPageInfo);
    });

    it('exposes fetchMore function for pagination', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.fetchMore).toBe(mockFetchMore);
    });
  });

  describe('memoization', () => {
    it('memoizes normalized pantry when data reference unchanged', () => {
      const mockPantryData = {
        id: mockPantryId,
        itemsConnection: { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
      };

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: mockPantryData },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: { hasNextPage: false, endCursor: null },
      });

      const { rerender } = renderHook(() => usePantryQuery(mockPantryId));

      const firstCallCount = mockNormalizePantry.mock.calls.length;
      rerender();
      const secondCallCount = mockNormalizePantry.mock.calls.length;

      // Should not call normalizePantry again if data reference unchanged
      expect(firstCallCount).toBe(secondCallCount);
    });

    it('memoizes items array when normalized pantry unchanged', () => {
      const mockItems = [createMockPantryItem('1', 'Milk')];

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: { itemsConnection: { edges: [], pageInfo: null } } },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      const mockNormalizedPantry = {
        items: mockItems,
        itemsPageInfo: undefined,
      };

      mockNormalizePantry.mockReturnValue(mockNormalizedPantry);

      const { result, rerender } = renderHook(() =>
        usePantryQuery(mockPantryId),
      );

      const firstItems = result.current.items;
      rerender();
      const secondItems = result.current.items;

      expect(firstItems).toBe(secondItems); // Same reference
    });

    it('recalculates when normalized pantry changes', () => {
      const mockItems1 = [createMockPantryItem('1', 'Milk')];
      const mockItems2 = [createMockPantryItem('2', 'Bread')];

      const mockPantryData1 = {
        pantry: {
          id: mockPantryId,
          itemsConnection: { edges: [], pageInfo: null }
        }
      };

      const mockPantryData2 = {
        pantry: {
          id: mockPantryId,
          itemsConnection: {
            edges: mockItems2.map(item => ({ node: item })),
            pageInfo: { hasNextPage: false, endCursor: null }
          }
        }
      };

      mockUseGetPantryQuery.mockReturnValueOnce({
        data: mockPantryData1,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValueOnce({
        items: mockItems1,
        itemsPageInfo: undefined,
      });

      const { result, rerender } = renderHook(() =>
        usePantryQuery(mockPantryId),
      );

      const firstItems = result.current.items;
      expect(firstItems).toEqual(mockItems1);

      // Change data to trigger memoization recalculation
      mockUseGetPantryQuery.mockReturnValue({
        data: mockPantryData2,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: mockItems2,
        itemsPageInfo: undefined,
      });

      rerender();

      const secondItems = result.current.items;
      expect(secondItems).toEqual(mockItems2);
      expect(firstItems).not.toBe(secondItems); // Different reference
    });
  });

  describe('edge cases', () => {
    it('handles empty string pantryId', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      renderHook(() => usePantryQuery(''));

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: true, // Empty string is falsy
        }),
      );
    });

    it('handles pantryId change', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { rerender } = renderHook(
        ({ pantryId }) => usePantryQuery(pantryId),
        { initialProps: { pantryId: 'pantry-1' } },
      );

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'pantry-1', itemsFirst: 25, storageLocationsFirst: 50 },
        }),
      );

      rerender({ pantryId: 'pantry-2' });

      expect(mockUseGetPantryQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { id: 'pantry-2', itemsFirst: 25, storageLocationsFirst: 50 },
        }),
      );
    });

    it('handles null pantry data', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: null },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.items).toEqual([]);
      expect(result.current.pageInfo).toBeUndefined();
    });

    it('handles undefined data', () => {
      mockUseGetPantryQuery.mockReturnValue({
        data: undefined,
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.items).toEqual([]);
    });

    it('handles very large item lists', () => {
      const mockItems = Array(10000)
        .fill(null)
        .map((_, i) => createMockPantryItem(`item-${i}`, `Item ${i}`));

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: { itemsConnection: { edges: [], pageInfo: null } } },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: mockItems,
        itemsPageInfo: { hasNextPage: true, endCursor: 'cursor-page-400' },
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.items).toHaveLength(10000);
    });
  });

  describe('real-world scenarios', () => {
    it('handles typical data flow: loading → loaded → updated', () => {
      // Initial loading
      mockUseGetPantryQuery.mockReturnValueOnce({
        data: undefined,
        loading: true,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: [],
        itemsPageInfo: undefined,
      });

      const { result, rerender } = renderHook(() =>
        usePantryQuery(mockPantryId),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.items).toEqual([]);

      // Loaded
      const mockItems = [createMockPantryItem('1', 'Milk')];
      const mockPageInfo = { hasNextPage: false, endCursor: null };

      mockUseGetPantryQuery.mockReturnValue({
        data: {
          pantry: {
            id: mockPantryId,
            itemsConnection: {
              edges: mockItems.map(item => ({ node: item })),
              pageInfo: mockPageInfo,
            },
          },
        },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: mockItems,
        itemsPageInfo: mockPageInfo,
      });

      rerender();

      expect(result.current.loading).toBe(false);
      expect(result.current.items).toEqual(mockItems);
    });

    it('handles Connection pattern with edges and nodes', () => {
      const mockItems = [
        createMockPantryItem('1', 'Milk'),
        createMockPantryItem('2', 'Bread'),
      ];

      const mockConnectionData = {
        id: mockPantryId,
        itemsConnection: {
          __typename: 'PantryItemConnection',
          edges: mockItems.map(item => ({
            __typename: 'PantryItemEdge',
            node: item,
            cursor: `cursor-${item.id}`,
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: true,
            hasPreviousPage: false,
            startCursor: 'cursor-1',
            endCursor: 'cursor-2',
          },
        },
      };

      mockUseGetPantryQuery.mockReturnValue({
        data: { pantry: mockConnectionData },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      });

      mockNormalizePantry.mockReturnValue({
        items: mockItems,
        itemsPageInfo: mockConnectionData.itemsConnection.pageInfo,
      });

      const { result } = renderHook(() => usePantryQuery(mockPantryId));

      expect(result.current.items).toEqual(mockItems);
      expect(result.current.pageInfo).toEqual(mockConnectionData.itemsConnection.pageInfo);
    });
  });
});
