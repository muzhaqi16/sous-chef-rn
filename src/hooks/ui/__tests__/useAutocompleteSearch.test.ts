import { renderHook, act } from '@testing-library/react-native';
import { useAutocompleteSearch, AutocompleteSearchConfig } from '../useAutocompleteSearch';

// Mock useAppStore to control isOnline
let mockIsOnline = true;
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({ isOnline: mockIsOnline }),
}));

jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

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
      useAutocompleteSearch(makeConfig({ fallbackItems: fallback, filterFallback })),
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
      useAutocompleteSearch(makeConfig({ search: mockSearch, debounceMs: 300 })),
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
      useAutocompleteSearch(makeConfig({ search: mockSearch, requiresNetwork: false })),
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
    const fallback: TestItem[] = [
      { id: '1', name: 'Cup' },
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
      useAutocompleteSearch(makeConfig({ fallbackItems: fallback, maxResults: 5 })),
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

  it('displays results from getResults when available and search meets minChars', () => {
    const apiResults: TestItem[] = [
      { id: '10', name: 'Milk' },
      { id: '11', name: 'Butter' },
    ];

    const { result } = renderHook(() =>
      useAutocompleteSearch(
        makeConfig({
          getResults: () => apiResults,
          minChars: 2,
        }),
      ),
    );

    act(() => {
      result.current.handleSearchTermChange('mi');
    });

    expect(result.current.displayItems).toEqual(apiResults);
  });
});
