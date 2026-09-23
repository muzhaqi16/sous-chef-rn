import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { SearchUnitsDocument } from '#operations/item/unit.generated';
import type { RootState } from '#store/index';
import type { UnitItem } from '#features/catalog/hooks/useUnitAutocomplete';
import { useUnitAutocomplete } from '#features/catalog/hooks/useUnitAutocomplete';

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

  it('asks the server while online even when a cached unit matches', async () => {
    // The cache holds the common units only; the server also matches plurals
    // and alternate names, so "sticks" finds stick.
    const m = recordMock(SearchUnitsDocument, {
      data: {
        searchUnits: [
          { __typename: 'Unit', id: 'u-stick', name: 'stick', symbol: 'stick' },
        ],
      },
    });
    const { result } = renderHookWithApollo(() => useUnitAutocomplete(), {
      operationMocks: [m.mock],
    });

    act(() => {
      result.current.handleSearchTermChange('sticks');
    });
    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() =>
      expect(result.current.displayItems.map(i => i.symbol)).toEqual(['stick']),
    );
    expect(m.fired).toEqual([{ query: 'sticks', limit: 10 }]);
  });

  it('matches the cached units while offline', () => {
    mockIsOnline = false;
    const { result } = renderHookWithApollo(
      () => useUnitAutocomplete(),
      apolloMocks,
    );

    act(() => {
      result.current.handleSearchTermChange('cup');
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

  it('filters by symbol match while offline', () => {
    mockIsOnline = false;
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
