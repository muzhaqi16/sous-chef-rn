import { act } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import type { RootState } from '#store/index';
import {
  useUnitAutocomplete,
  UnitItem,
} from '#features/catalog/hooks/useUnitAutocomplete';

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
jest.mock('#store/useAppStore', () => {
  const getState = (): RootState =>
    ({
      isOnline: mockIsOnline,
      cachedUnits: mockCachedUnits,
      setCachedUnits: mockSetCachedUnits,
      lastUnitsFetchedAt: Date.now(),
      setLastUnitsFetchedAt: mockSetLastUnitsFetchedAt,
    } as Partial<RootState> as RootState);
  return {
    useAppStore: <T>(selector: (state: RootState) => T): T =>
      selector(getState()),
    useIsOnline: () => getState().isOnline,
  };
});

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
});

afterEach(() => {
  jest.useRealTimers();
});

/**
 * Per CLAUDE.md "Apollo Test Patterns": tests assert local-state behavior;
 * the SearchUnits query is gated by `skip` and localFirst, so most paths
 * never hit the network. Schema-driven `mocks` returning empty searchUnits
 * matches the original mock behavior without operation-name plumbing.
 */
const apolloMocks = {
  mocks: {
    Query: () => ({
      searchUnits: [],
      units: [],
    }),
  },
};

describe('useUnitAutocomplete', () => {
  it('returns cached units as displayItems initially', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    expect(result.current.displayItems).toEqual(mockCachedUnits);
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    expect(result.current.searchTerm).toBe('');
  });

  it('filters cached units locally when typing a short term (below minChars)', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    act(() => {
      result.current.handleSearchTermChange('c');
    });

    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Cup');
    expect(names).toContain('Ounce');
  });

  it('uses local-first search: matches cached units before API for terms >= minChars', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    act(() => {
      result.current.handleSearchTermChange('cup');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.displayItems).toEqual([
      { id: 'u1', name: 'Cup', symbol: 'cup' },
    ]);
  });

  it('shows all cached units when searchTerm is empty', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    expect(result.current.displayItems).toHaveLength(5);
  });

  it('resets searchTerm and displayItems on reset', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

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
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    act(() => {
      result.current.handleSearchTermChange('tbsp');
    });

    const names = result.current.displayItems.map(i => i.name);
    expect(names).toContain('Tablespoon');
  });

  it('returns isOnline from the store', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    expect(result.current.isOnline).toBe(true);
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    act(() => {
      result.current.handleSearchTermChange('oz');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('returns isLoading false when query is not loading', () => {
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    expect(result.current.isLoading).toBe(false);
  });
});
