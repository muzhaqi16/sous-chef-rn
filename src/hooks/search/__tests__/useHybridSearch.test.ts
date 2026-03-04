import { renderHook, act } from '@testing-library/react-native';
import { useHybridSearch, type UseHybridSearchConfig } from '../useHybridSearch';

// --- Apollo client mock (stable reference prevents infinite effect loop) ---
const mockQuery = jest.fn();
const mockClient = { query: mockQuery };
jest.mock('@apollo/client/react', () => ({
  useApolloClient: () => mockClient,
}));

// --- Identity debounce so values propagate instantly ---
jest.mock('#hooks/utils/useDebouncedValue', () => ({
  useDebouncedValue: (value: unknown) => value,
}));

// --- Prevent heavy transitive imports ---
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

/** Flush the async effect chain (queryFn → executeSearchQuery → setServerState). */
const flushEffects = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useHybridSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ data: { results: [] } });
  });

  describe('local search', () => {
    it('filters items locally when useServerSort is false', () => {
      const items = makeItems(3);
      const { result } = renderHook(() =>
        useHybridSearch({ ...defaultConfig, items, totalCount: 3 }),
      );

      expect(result.current.activeItems).toHaveLength(3);
      expect(result.current.useServerSort).toBe(false);

      act(() => {
        result.current.setSearchQuery('Item 2');
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
      await flushEffects();

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

      act(() => {
        result.current.setSearchQuery('Server');
      });
      await flushEffects();

      expect(result.current.activeItems).toEqual(serverItems);

      // Clear search — should immediately show main items
      act(() => {
        result.current.setSearchQuery('');
      });

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
      await flushEffects();
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
      await flushEffects();

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

      // Start a search (effect fires immediately since debounce is identity)
      act(() => {
        result.current.setSearchQuery('Olive');
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

      act(() => {
        result.current.setSearchQuery('Olive');
      });
      await flushEffects();

      expect(result.current.activeItems).toHaveLength(2);

      act(() => {
        result.current.removeFromResults('s1');
      });

      expect(result.current.activeItems).toHaveLength(1);
      expect(result.current.activeItems[0].id).toBe('s2');
    });
  });
});
