'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { useHybridSearch, type UseHybridSearchConfig } from '../useHybridSearch';

// --- Apollo client mock ---
const mockQuery = jest.fn();
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => ({ query: mockQuery }),
}));

// --- Prevent heavy transitive imports from OOMing Jest ---
jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeSearchQuery: async (
    queryFn: () => Promise<{ data?: any }>,
    cancelled: () => boolean,
  ) => {
    try {
      const result = await queryFn();
      if (cancelled()) return null;
      return result.data ?? null;
    } catch {
      return null;
    }
  },
}));
jest.mock('#/utils/hybridSort', () => ({
  shouldUseServerSort: (totalCount: number, pageSize: number, isOnline: boolean) =>
    isOnline && totalCount > pageSize,
}));

// --- Fake document ---
const FAKE_DOCUMENT = {} as any;

// --- Test item type ---
interface TestItem {
  id: string;
  itemName: string;
}

const makeItems = (count: number): TestItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    itemName: `Item ${i + 1}`,
  }));

const defaultConfig: UseHybridSearchConfig<{ results: TestItem[] }, TestItem> = {
  items: [],
  totalCount: 0,
  hasMore: false,
  loading: false,
  pageSize: 50,
  isOnline: true,
  searchDocument: FAKE_DOCUMENT,
  buildSearchVariables: (search) => ({ search }),
  extractItems: (data) => data.results,
  searchPredicate: (item, query) =>
    (item.itemName ?? '').toLowerCase().includes(query.toLowerCase()),
  debounceMs: 300,
};

describe('useHybridSearch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ data: { results: [] } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('local search', () => {
    it('filters items locally when useServerSort is false', () => {
      const items = makeItems(3);
      const { result } = renderHook(() =>
        useHybridSearch({ ...defaultConfig, items, totalCount: 3 }),
      );

      // No search — all items returned
      expect(result.current.activeItems).toHaveLength(3);
      expect(result.current.useServerSort).toBe(false);

      // Type a search
      act(() => {
        result.current.setSearchQuery('Item 2');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.activeItems).toHaveLength(1);
      expect(result.current.activeItems[0].itemName).toBe('Item 2');
    });

    it('does not fire server query for local search', () => {
      const items = makeItems(3);
      const { result } = renderHook(() =>
        useHybridSearch({ ...defaultConfig, items, totalCount: 3 }),
      );

      act(() => {
        result.current.setSearchQuery('Item 1');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('server search', () => {
    it('fires client.query() when useServerSort is true and search is active', async () => {
      const serverItems = [{ id: 's1', itemName: 'Server Result' }];
      mockQuery.mockResolvedValue({ data: { results: serverItems } });

      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          items: makeItems(5),
          totalCount: 100,
          hasMore: true,
        }),
      );

      expect(result.current.useServerSort).toBe(true);

      act(() => {
        result.current.setSearchQuery('Server');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Flush the async effect chain (queryFn resolve → executeSearchQuery resolve → setServerState)
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          query: FAKE_DOCUMENT,
          variables: { search: 'Server' },
          fetchPolicy: 'network-only',
        }),
      );
      expect(result.current.activeItems).toEqual(serverItems);
    });
  });

  describe('debounce', () => {
    it('delays server search by configured ms', () => {
      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          totalCount: 100,
          hasMore: true,
        }),
      );

      act(() => {
        result.current.setSearchQuery('test');
      });

      // Before debounce expires
      expect(mockQuery).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(mockQuery).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(1);
      });
      // After debounce expires, the query fires
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('instant clear', () => {
    it('immediately clears results when search is set to empty', async () => {
      const serverItems = [{ id: 's1', itemName: 'Server Result' }];
      mockQuery.mockResolvedValue({ data: { results: serverItems } });

      const items = makeItems(5);
      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          items,
          totalCount: 100,
          hasMore: true,
        }),
      );

      // Trigger a search
      act(() => {
        result.current.setSearchQuery('Server');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.activeItems).toEqual(serverItems);

      // Clear search — should immediately show main items
      act(() => {
        result.current.setSearchQuery('');
      });

      // No debounce needed — items should be the main query items
      expect(result.current.searchActive).toBe(false);
      expect(result.current.activeItems).toBe(items);
    });
  });

  describe('second search with same term', () => {
    it('returns results when re-searching the same term after clear', async () => {
      const serverItems = [{ id: 's1', itemName: 'Olive Oil' }];
      mockQuery.mockResolvedValue({ data: { results: serverItems } });

      const items = makeItems(5);
      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          items,
          totalCount: 100,
          hasMore: true,
        }),
      );

      // First search
      act(() => {
        result.current.setSearchQuery('Olive');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(result.current.activeItems).toEqual(serverItems);

      // Clear
      act(() => {
        result.current.setSearchQuery('');
      });
      expect(result.current.activeItems).toBe(items);

      // Second search with same term
      mockQuery.mockClear();
      mockQuery.mockResolvedValue({ data: { results: serverItems } });

      act(() => {
        result.current.setSearchQuery('Olive');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      // Should have fired a new query and returned results
      expect(mockQuery).toHaveBeenCalled();
      expect(result.current.activeItems).toEqual(serverItems);
    });
  });

  describe('cancellation', () => {
    it('does not show stale results when search is cleared during in-flight request', async () => {
      let resolveQuery: (value: any) => void;
      mockQuery.mockReturnValue(
        new Promise((resolve) => {
          resolveQuery = resolve;
        }),
      );

      const items = makeItems(5);
      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          items,
          totalCount: 100,
          hasMore: true,
        }),
      );

      // Start a search
      act(() => {
        result.current.setSearchQuery('Olive');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      // Clear search while query is in-flight
      act(() => {
        result.current.setSearchQuery('');
      });

      // Resolve the stale query
      await act(async () => {
        resolveQuery!({ data: { results: [{ id: 'stale', itemName: 'Stale' }] } });
        await Promise.resolve();
      });

      // Should NOT show stale results — should show main items
      expect(result.current.activeItems).toBe(items);
      expect(result.current.activeItems.find(i => i.id === 'stale')).toBeUndefined();
    });
  });

  describe('allItemsLoaded tracking', () => {
    it('transitions to local search when all pages are loaded', () => {
      const items = makeItems(55);

      // Start with hasMore: true (server sort)
      const { result, rerender } = renderHook(
        (props: Partial<typeof defaultConfig>) =>
          useHybridSearch({ ...defaultConfig, ...props }),
        {
          initialProps: { items, totalCount: 55, hasMore: true },
        },
      );

      expect(result.current.useServerSort).toBe(true);

      // Rerender with hasMore: false — all pages loaded
      rerender({ items, totalCount: 55, hasMore: false });

      expect(result.current.useServerSort).toBe(false);
    });

    it('resets when hasMore becomes true again (new items added)', () => {
      const items = makeItems(55);

      const { result, rerender } = renderHook(
        (props: Partial<typeof defaultConfig>) =>
          useHybridSearch({ ...defaultConfig, ...props }),
        {
          initialProps: { items, totalCount: 55, hasMore: false } as Partial<typeof defaultConfig>,
        },
      );

      expect(result.current.useServerSort).toBe(false);

      // New items added — hasMore becomes true again
      rerender({ items, totalCount: 60, hasMore: true });

      expect(result.current.useServerSort).toBe(true);
    });
  });

  describe('buildSearchVariables returns null', () => {
    it('does not fire server query when variables are null', () => {
      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          totalCount: 100,
          hasMore: true,
          buildSearchVariables: () => null,
        }),
      );

      act(() => {
        result.current.setSearchQuery('test');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe('removeFromResults', () => {
    it('removes an item from server search results by id', async () => {
      const serverItems = [
        { id: 's1', itemName: 'Olive Oil' },
        { id: 's2', itemName: 'Olives' },
      ];
      mockQuery.mockResolvedValue({ data: { results: serverItems } });

      const { result } = renderHook(() =>
        useHybridSearch({
          ...defaultConfig,
          items: makeItems(5),
          totalCount: 100,
          hasMore: true,
        }),
      );

      // Trigger server search
      act(() => {
        result.current.setSearchQuery('Olive');
      });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.activeItems).toHaveLength(2);

      // Remove one item
      act(() => {
        result.current.removeFromResults('s1');
      });

      expect(result.current.activeItems).toHaveLength(1);
      expect(result.current.activeItems[0].id).toBe('s2');
    });
  });
});
