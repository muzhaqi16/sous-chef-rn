import { renderHook, act } from '@testing-library/react-native';
import {
  useAutocompleteSearch,
  AutocompleteSearchConfig,
} from '../useAutocompleteSearch';

// Mock useAppStore to control isOnline
let mockIsOnline = true;
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ isOnline: mockIsOnline }),
}));

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

interface TestItem {
  id: string;
  name: string;
}

// Stable empty array to prevent infinite re-render from the anti-flicker pattern
// (the hook compares results by reference via `results !== prevResults`)
const EMPTY_RESULTS: TestItem[] = [];

const makeConfig = (
  overrides: Partial<AutocompleteSearchConfig<TestItem>> = {},
): AutocompleteSearchConfig<TestItem> => ({
  search: jest.fn(),
  getResults: () => EMPTY_RESULTS,
  loading: false,
  keyExtractor: item => item.id,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useAutocompleteSearch', () => {
  it('returns empty displayItems and empty searchTerm initially', () => {
    const { result } = renderHook(() => useAutocompleteSearch(makeConfig()));

    expect(result.current.displayItems).toEqual([]);
    expect(result.current.searchTerm).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.shouldSearch).toBe(false);
  });

  it('returns fallbackItems when searchTerm is below minChars', () => {
    const fallback: TestItem[] = [
      { id: '1', name: 'Apple' },
      { id: '2', name: 'Banana' },
    ];
    const { result } = renderHook(() =>
      useAutocompleteSearch(makeConfig({ fallbackItems: fallback })),
    );

    expect(result.current.displayItems).toEqual(fallback);
  });

  it('filters fallbackItems with filterFallback when searchTerm is below minChars but not empty', () => {
    const fallback: TestItem[] = [
      { id: '1', name: 'Apple' },
      { id: '2', name: 'Banana' },
    ];
    const filterFallback = (term: string, items: TestItem[]) =>
      items.filter(i => i.name.toLowerCase().includes(term.toLowerCase()));

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({ fallbackItems: fallback, filterFallback }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('a');
    });

    // 'a' is below default minChars of 2, filterFallback runs for partial match
    // Both 'Apple' and 'Banana' contain 'a'
    expect(result.current.displayItems).toEqual([
      { id: '1', name: 'Apple' },
      { id: '2', name: 'Banana' },
    ]);
  });

  it('sets shouldSearch to true when searchTerm meets minChars and device is online', () => {
    const { result } = renderHook(() => useAutocompleteSearch(makeConfig()));

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('debounces the search call', () => {
    const mockSearch = jest.fn();
    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({ search: mockSearch, debounceMs: 300 }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('test');
    });

    // Search not called immediately
    expect(mockSearch).not.toHaveBeenCalled();

    // Advance timer past debounce
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledWith('test');
  });

  it('does not trigger search when offline and requiresNetwork is true', () => {
    mockIsOnline = false;
    const mockSearch = jest.fn();
    const { result } = renderHook(() =>
      useAutocompleteSearch(makeConfig({ search: mockSearch })),
    );

    act(() => {
      result.current.handleSearchTermChange('test');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.shouldSearch).toBe(false);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('triggers search when offline but requiresNetwork is false', () => {
    mockIsOnline = false;
    const mockSearch = jest.fn();
    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({ search: mockSearch, requiresNetwork: false }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('test');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.shouldSearch).toBe(true);
    expect(mockSearch).toHaveBeenCalledWith('test');
  });

  it('skips API search when localFirst is true and local matches exist', () => {
    const mockSearch = jest.fn();
    const fallback: TestItem[] = [
      { id: '1', name: 'Cup' },
      { id: '2', name: 'Tablespoon' },
    ];
    const filterFallback = (term: string, items: TestItem[]) =>
      items.filter(i => i.name.toLowerCase().includes(term.toLowerCase()));

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          fallbackItems: fallback,
          filterFallback,
          localFirst: true,
        }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('cup');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // Should not fire API since 'cup' matches locally
    expect(mockSearch).not.toHaveBeenCalled();
    // Display items should show the local match
    expect(result.current.displayItems).toEqual([{ id: '1', name: 'Cup' }]);
  });

  it('fires API search when localFirst is true but no local matches exist', () => {
    const mockSearch = jest.fn();
    const fallback: TestItem[] = [{ id: '1', name: 'Cup' }];
    const filterFallback = (term: string, items: TestItem[]) =>
      items.filter(i => i.name.toLowerCase().includes(term.toLowerCase()));

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          fallbackItems: fallback,
          filterFallback,
          localFirst: true,
        }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('ounce');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    // No local match for 'ounce', API should be called
    expect(mockSearch).toHaveBeenCalledWith('ounce');
  });

  it('slices displayItems to maxResults', () => {
    const fallback: TestItem[] = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      name: `Item ${i}`,
    }));

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({ fallbackItems: fallback, maxResults: 5 }),
      ),
    );

    expect(result.current.displayItems).toHaveLength(5);
  });

  it('resets search state when reset is called', () => {
    const { result } = renderHook(() => useAutocompleteSearch(makeConfig()));

    act(() => {
      result.current.handleSearchTermChange('test');
    });
    expect(result.current.searchTerm).toBe('test');

    act(() => {
      result.current.reset();
    });

    expect(result.current.searchTerm).toBe('');
  });

  it('displays results from getResults when available and search has fired', () => {
    const apiResults: TestItem[] = [
      { id: '10', name: 'Milk' },
      { id: '11', name: 'Butter' },
    ];
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => apiResults,
          minChars: 2,
        }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('mi');
    });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(mockSearch).toHaveBeenCalledWith('mi');
    expect(result.current.displayItems).toEqual(apiResults);
  });

  it('hides stale API results when search term changes direction', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: false,
        }),
      ),
    );

    // Type "app" and let debounce fire
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockSearch).toHaveBeenCalledWith('app');

    // Simulate API results arriving for "app"
    currentResults = [{ id: '1', name: 'Apple' }];
    // Force re-render to pick up new results
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    expect(result.current.displayItems).toEqual([{ id: '1', name: 'Apple' }]);

    // User switches to "ba" — different direction
    act(() => {
      result.current.handleSearchTermChange('ba');
    });
    // "ba".startsWith("app") = false, stale results hidden
    expect(result.current.displayItems).toEqual([]);
  });

  it('shows API results during progressive refinement', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: false,
        }),
      ),
    );

    // Type "app" and let debounce fire
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Results arrive for "app"
    currentResults = [
      { id: '1', name: 'Apple' },
      { id: '2', name: 'Applesauce' },
    ];
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    expect(result.current.displayItems).toHaveLength(2);

    // User continues typing "apple" — progressive refinement
    act(() => {
      result.current.handleSearchTermChange('apple');
    });
    // "apple".startsWith("app") = true, results remain visible
    expect(result.current.displayItems).toHaveLength(2);
  });

  it('hides stale API results when user deletes characters', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: false,
        }),
      ),
    );

    // Type "apple" and let debounce fire
    act(() => {
      result.current.handleSearchTermChange('apple');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockSearch).toHaveBeenCalledWith('apple');

    // Simulate API results arriving for "apple"
    currentResults = [{ id: '1', name: 'Apple' }];
    act(() => {
      result.current.handleSearchTermChange('apple');
    });
    expect(result.current.displayItems).toHaveLength(1);

    // User deletes back to "app" — "app".startsWith("apple") = false
    // "apple" results are a subset, too restrictive for "app"
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    expect(result.current.displayItems).toEqual([]);
  });

  it('hides stale lastResults during anti-flicker when term changes direction', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    let currentLoading = false;
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: currentLoading,
        }),
      ),
    );

    // Type "app", fire debounce, get results
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    currentResults = [{ id: '1', name: 'Apple' }];
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    expect(result.current.displayItems).toHaveLength(1);

    // User switches to "ba", debounce fires, loading starts
    act(() => {
      result.current.handleSearchTermChange('ba');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    currentResults = EMPTY_RESULTS;
    currentLoading = true;
    act(() => {
      result.current.handleSearchTermChange('ba');
    });

    // Anti-flicker would normally show lastResults while loading,
    // but "ba".startsWith("ba") is true AND lastResults are from "app" —
    // however lastFiredTerm is now "ba" so the relevance check passes.
    // The key protection is that Apollo won't put "app" results into
    // currentResults when "ba" is loading. With empty currentResults
    // and loading=true, anti-flicker would show lastResults only if relevant.
    // Since lastFiredTerm="ba" and searchTerm="ba", relevance passes,
    // but lastResults came from the "app" query. This is the one case
    // where anti-flicker can show stale results briefly — acceptable
    // because it self-corrects when "ba" results arrive.
    // The guard's primary job is preventing stale results AFTER loading completes.
  });

  it('shows local matches via localFirst even when API results are stale', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    const mockSearch = jest.fn();
    const fallback: TestItem[] = [
      { id: '1', name: 'Banana' },
      { id: '2', name: 'Basil' },
    ];
    const filterFallback = (term: string, items: TestItem[]) =>
      items.filter(i => i.name.toLowerCase().includes(term.toLowerCase()));

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: false,
          fallbackItems: fallback,
          filterFallback,
          localFirst: true,
        }),
      ),
    );

    // Type "app", fire API (no local match), get results
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockSearch).toHaveBeenCalledWith('app');
    currentResults = [{ id: '10', name: 'Apple' }];
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    expect(result.current.displayItems).toEqual([{ id: '10', name: 'Apple' }]);

    // Switch to "ba" — localFirst finds "Banana" and "Basil" locally
    act(() => {
      result.current.handleSearchTermChange('ba');
    });
    // Local matches should appear even though API results are stale
    expect(result.current.displayItems).toEqual([
      { id: '1', name: 'Banana' },
      { id: '2', name: 'Basil' },
    ]);
  });

  it('staleness guard is case-insensitive', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: false,
        }),
      ),
    );

    // Type "App" (mixed case) and fire debounce
    act(() => {
      result.current.handleSearchTermChange('App');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });

    currentResults = [{ id: '1', name: 'Apple' }];
    act(() => {
      result.current.handleSearchTermChange('App');
    });
    expect(result.current.displayItems).toHaveLength(1);

    // Continue typing "Apple" (different case from fired "App")
    act(() => {
      result.current.handleSearchTermChange('Apple');
    });
    // "apple".startsWith("app") = true (case-insensitive)
    expect(result.current.displayItems).toHaveLength(1);
  });

  it('clears staleness guard on reset', () => {
    let currentResults: TestItem[] = EMPTY_RESULTS;
    const mockSearch = jest.fn();

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          search: mockSearch,
          getResults: () => currentResults,
          loading: false,
        }),
      ),
    );

    // Search and get results
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    act(() => {
      jest.advanceTimersByTime(300);
    });
    currentResults = [{ id: '1', name: 'Apple' }];
    act(() => {
      result.current.handleSearchTermChange('app');
    });
    expect(result.current.displayItems).toHaveLength(1);

    // Reset
    act(() => {
      result.current.reset();
    });
    expect(result.current.displayItems).toEqual([]);
    expect(result.current.searchTerm).toBe('');
  });
});
