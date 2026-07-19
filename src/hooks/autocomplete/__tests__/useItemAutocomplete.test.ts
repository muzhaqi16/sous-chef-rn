import { act } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import {
  AutocompleteItemsDocument,
  SearchItemsSemanticDocument,
} from '#operations/item/item.generated';
import { useItemAutocomplete } from '../useItemAutocomplete';
import type { RootState } from '#store/index';
import { ItemType, type ItemSuggestion } from '#/graphql/generated/schemaTypes';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const makeSuggestion = (id: string, name: string): ItemSuggestion => ({
  __typename: 'ItemSuggestion',
  id,
  name,
  type: ItemType.Food,
  brands: [],
  category: null,
  defaultUnit: null,
  displayUnit: null,
  imageUrl: null,
  netWeight: null,
});

let mockIsOnline = true;
let mockCachedItemSuggestions: ItemSuggestion[] = [];
const mockAddCachedItemSuggestions = jest.fn();
jest.mock('#store/useAppStore', () => {
  const getState = () =>
    ({
      isOnline: mockIsOnline,
      cachedItemSuggestions: mockCachedItemSuggestions,
      addCachedItemSuggestions: mockAddCachedItemSuggestions,
    } as Partial<RootState> as RootState);
  return {
    useAppStore: <T>(selector: (state: RootState) => T): T =>
      selector(getState()),
    useIsOnline: () => getState().isOnline,
  };
});

/**
 * Per CLAUDE.md "Apollo Test Patterns": variable-recording mocks via the
 * `variables: () => true` matcher capture the inputs the hook fires through
 * useLazyQuery, replacing the legacy `mockFetchItems.toHaveBeenCalledWith`
 * spy pattern.
 */
function createItemsMock(
  recorded: Array<Record<string, unknown>>,
): MockedResponse {
  return {
    request: {
      query: AutocompleteItemsDocument,
      variables: vars => {
        recorded.push(vars);
        return true;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: { data: { autocompleteItems: [] } },
  };
}
function createSemanticMock(): MockedResponse {
  return {
    request: {
      query: SearchItemsSemanticDocument,
      variables: () => true,
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: { data: { searchItemsSemantic: [] } },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockIsOnline = true;
  mockCachedItemSuggestions = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useItemAutocomplete', () => {
  it('returns empty displayItems initially', () => {
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    expect(result.current.displayItems).toEqual([]);
  });

  it('returns empty searchTerm initially', () => {
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    expect(result.current.searchTerm).toBe('');
  });

  it('updates searchTerm via handleSearchTermChange', () => {
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('milk');
    });

    expect(result.current.searchTerm).toBe('milk');
  });

  it('triggers lazy query after debounce when term meets minChars', () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(() => useItemAutocomplete(), {
      operationMocks: [createItemsMock(recorded), createSemanticMock()],
    });

    act(() => {
      result.current.handleSearchTermChange('mi');
    });

    act(() => {
      jest.advanceTimersByTime(250);
    });

    expect(recorded).toContainEqual({ input: { query: 'mi', limit: 10 } });
  });

  it('uses custom debounceMs when provided', () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(
      () => useItemAutocomplete({ debounceMs: 500 }),
      { operationMocks: [createItemsMock(recorded), createSemanticMock()] },
    );

    act(() => {
      result.current.handleSearchTermChange('egg');
    });

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(recorded).toEqual([]);

    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(recorded).toContainEqual({ input: { query: 'egg', limit: 10 } });
  });

  it('does not trigger search when term is below minChars', () => {
    const recorded: Array<Record<string, unknown>> = [];
    const { result } = renderHookWithApollo(() => useItemAutocomplete(), {
      operationMocks: [createItemsMock(recorded), createSemanticMock()],
    });

    act(() => {
      result.current.handleSearchTermChange('m');
    });

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(recorded).toEqual([]);
  });

  it('sets shouldSearch to true when searchTerm meets minChars and is online', () => {
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('ab');
    });

    expect(result.current.shouldSearch).toBe(true);
  });

  it('sets shouldSearch to false when offline', () => {
    mockIsOnline = false;
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('milk');
    });

    expect(result.current.shouldSearch).toBe(false);
  });

  it('resets state when reset is called', () => {
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('test');
    });
    expect(result.current.searchTerm).toBe('test');

    act(() => {
      result.current.reset();
    });

    expect(result.current.searchTerm).toBe('');
    expect(result.current.displayItems).toEqual([]);
  });

  it('returns isLoading false when query is not loading', () => {
    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    expect(result.current.isLoading).toBe(false);
  });

  it('offline cold-start: serves persisted seen-items as fallback suggestions', () => {
    // Simulates a cold start where the persisted LRU (cachedItemSuggestions)
    // was rehydrated but there is no network. With localFirst active offline,
    // a matching cached item must surface without any query firing.
    mockIsOnline = false;
    mockCachedItemSuggestions = [
      makeSuggestion('i1', 'Milk'),
      makeSuggestion('i2', 'Bread'),
    ];

    const { result } = renderHookWithApollo(() => useItemAutocomplete());

    act(() => {
      result.current.handleSearchTermChange('mil');
    });
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(result.current.displayItems).toContainEqual(
      expect.objectContaining({ id: 'i1', name: 'Milk' }),
    );
    expect(result.current.displayItems).not.toContainEqual(
      expect.objectContaining({ id: 'i2' }),
    );
  });
});
