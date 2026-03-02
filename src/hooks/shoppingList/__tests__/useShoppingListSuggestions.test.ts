import { renderHook } from '@testing-library/react-native';
import { useShoppingListSuggestions } from '../useShoppingListSuggestions';

// --- Mocks ---

let mockIsOffline = false;
let mockQueryResult: any = {
  data: null,
  loading: false,
  error: undefined,
  refetch: jest.fn(),
};

jest.mock('#generated', () => ({
  useGetShoppingListSuggestionsQuery: (options: any) => {
    // Store the skip state for test assertions
    if (options.skip) {
      return {
        data: null,
        loading: false,
        error: undefined,
        refetch: jest.fn(),
      };
    }
    return mockQueryResult;
  },
  SuggestionSource: {
    RecentlyDeleted: 'RECENTLY_DELETED',
    FrequentlyAdded: 'FREQUENTLY_ADDED',
    Popular: 'POPULAR',
  },
}));

jest.mock('#hooks/settings/useOfflineMode', () => ({
  useIsEffectivelyOffline: () => mockIsOffline,
}));

jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: jest.fn(() => null),
}));

jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOffline = false;
  mockQueryResult = {
    data: null,
    loading: false,
    error: undefined,
    refetch: jest.fn(),
  };
});

function createSuggestion(
  id: string,
  source: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    itemName: `Item ${id}`,
    source,
    imageUrl: null,
    ...overrides,
  };
}

describe('useShoppingListSuggestions', () => {
  it('returns empty state when no data', () => {
    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.grouped.recentlyDeleted).toEqual([]);
    expect(result.current.grouped.frequentlyAdded).toEqual([]);
    expect(result.current.grouped.popular).toEqual([]);
  });

  it('groups suggestions by source', () => {
    mockQueryResult = {
      data: {
        shoppingList: {
          suggestions: [
            createSuggestion('1', 'RECENTLY_DELETED'),
            createSuggestion('2', 'FREQUENTLY_ADDED'),
            createSuggestion('3', 'POPULAR'),
            createSuggestion('4', 'RECENTLY_DELETED'),
          ],
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.grouped.recentlyDeleted).toHaveLength(2);
    expect(result.current.grouped.frequentlyAdded).toHaveLength(1);
    expect(result.current.grouped.popular).toHaveLength(1);
    expect(result.current.hasSuggestions).toBe(true);
  });

  it('returns all suggestions in flat array', () => {
    mockQueryResult = {
      data: {
        shoppingList: {
          suggestions: [
            createSuggestion('1', 'RECENTLY_DELETED'),
            createSuggestion('2', 'POPULAR'),
          ],
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.suggestions).toHaveLength(2);
  });

  it('returns empty suggestions when offline', () => {
    mockIsOffline = true;

    mockQueryResult = {
      data: {
        shoppingList: {
          suggestions: [createSuggestion('1', 'POPULAR')],
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.isOffline).toBe(true);
  });

  it('exposes loading state', () => {
    mockQueryResult = {
      data: null,
      loading: true,
      error: undefined,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.loading).toBe(true);
  });

  it('exposes error state', () => {
    const testError = new Error('Network error');
    mockQueryResult = {
      data: null,
      loading: false,
      error: testError,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.error).toBe(testError);
  });

  it('exposes refetch function', () => {
    const mockRefetch = jest.fn();
    mockQueryResult = {
      data: null,
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.refetch).toBe(mockRefetch);
  });

  it('hasSuggestions is false when all groups are empty', () => {
    mockQueryResult = {
      data: {
        shoppingList: {
          suggestions: [],
        },
      },
      loading: false,
      error: undefined,
      refetch: jest.fn(),
    };

    const { result } = renderHook(() =>
      useShoppingListSuggestions({ shoppingListId: 'list-1' }),
    );

    expect(result.current.hasSuggestions).toBe(false);
  });
});
