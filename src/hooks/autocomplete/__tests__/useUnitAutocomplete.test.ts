import { renderHook, act } from '@testing-library/react-native';
import { useUnitAutocomplete, UnitItem } from '../useUnitAutocomplete';

const mockCachedUnits: UnitItem[] = [
  { id: 'u1', name: 'Cup', symbol: 'cup' },
  { id: 'u2', name: 'Tablespoon', symbol: 'tbsp' },
  { id: 'u3', name: 'Teaspoon', symbol: 'tsp' },
  { id: 'u4', name: 'Ounce', symbol: 'oz' },
  { id: 'u5', name: 'Gram', symbol: 'g' },
];

let mockIsOnline = true;
const mockSetCachedUnits = jest.fn();
const mockSetLastUnitsFetchedAt = jest.fn();
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      isOnline: mockIsOnline,
      cachedUnits: mockCachedUnits,
      setCachedUnits: mockSetCachedUnits,
      lastUnitsFetchedAt: Date.now(), // Fresh cache to skip preload in tests
      setLastUnitsFetchedAt: mockSetLastUnitsFetchedAt,
    }),
}));

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockSearchUnitsData = { searchUnits: [] as UnitItem[] };
const mockUseSearchUnitsQuery = jest.fn<any, [any]>(() => ({
  data: mockSearchUnitsData,
  loading: false,
}));

const mockFetchCommonUnits = jest.fn().mockResolvedValue({ data: null });
jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useSearchUnitsQuery: (options: any) => mockUseSearchUnitsQuery(options),
  useGetCommonUnitsLazyQuery: () => [mockFetchCommonUnits, { data: null }],
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
  mockSearchUnitsData.searchUnits = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useUnitAutocomplete', () => {
  it('returns cached units as displayItems initially', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    expect(result.current.displayItems).toEqual(mockCachedUnits);
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    expect(result.current.searchTerm).toBe('');
  });

  it('filters cached units locally when typing a short term (below minChars)', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('c');
    });

    // 'c' is below minChars=2 but filterFallback runs for partial match
    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Cup');
    expect(names).toContain('Ounce');
  });

  it('uses local-first search: matches cached units before API for terms >= minChars', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('cup');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    // 'cup' matches locally in cachedUnits, so API should not be triggered
    // displayItems should contain the local match
    expect(result.current.displayItems).toEqual([
      { id: 'u1', name: 'Cup', symbol: 'cup' },
    ]);
  });

  it('shows all cached units when searchTerm is empty', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    expect(result.current.displayItems).toHaveLength(5);
  });

  it('resets searchTerm and displayItems on reset', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('gram');
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.displayItems).toEqual(mockCachedUnits);
  });

  it('filters by symbol match', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('tbsp');
    });

    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Tablespoon');
  });

  it('returns isOnline from the store', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    expect(result.current.isOnline).toBe(true);

    // We can't change mockIsOnline mid-render easily, but initial value is checked
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('oz');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('returns isLoading false when query is not loading', () => {
    const { result } = renderHook(() => useUnitAutocomplete());

    expect(result.current.isLoading).toBe(false);
  });
});
