import { renderHook } from '@testing-library/react-native';
import { usePantryItemSuggestions } from '../usePantryItemSuggestions';

// Mock offline mode hook
let mockIsOffline = false;
jest.mock('#hooks/settings/useOfflineMode', () => ({
  useIsEffectivelyOffline: () => mockIsOffline,
}));

// Mock image utilities
jest.mock('#utils/imageUtils', () => ({
  resolveImageUrl: (item: any) =>
    item?.imageUrl ? `https://cdn.test/${item.imageUrl}` : null,
}));

// Mock image preloading
const mockPreloadImages = jest.fn();
jest.mock('#components/atoms/CachedImage', () => ({
  preloadImages: (...args: unknown[]) => mockPreloadImages(...args),
}));

// Mock generated hooks/enums
const mockQueryResult = {
  data: undefined as any,
  loading: false,
  error: undefined,
  refetch: jest.fn().mockResolvedValue({}),
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useGetPantryItemSuggestionsQuery: jest.fn(() => mockQueryResult),
}));

const { PantrySuggestionSource } = jest.requireMock('#generated');

function createSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sug-1',
    itemName: 'Milk',
    source: PantrySuggestionSource.LowStock,
    imageUrl: 'milk.jpg',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsOffline = false;
  mockQueryResult.data = undefined;
  mockQueryResult.loading = false;
  mockQueryResult.error = undefined;
});

describe('usePantryItemSuggestions', () => {
  it('returns empty state when no data', () => {
    const { result } = renderHook(() =>
      usePantryItemSuggestions({ pantryId: 'pantry-1' }),
    );

    expect(result.current.suggestions).toEqual([]);
    expect(result.current.hasSuggestions).toBe(false);
    expect(result.current.loading).toBe(false);
  });

  it('returns suggestions with resolved imageUrl', () => {
    mockQueryResult.data = {
      pantry: {
        suggestions: [createSuggestion()],
      },
    };

    const { result } = renderHook(() =>
      usePantryItemSuggestions({ pantryId: 'pantry-1' }),
    );

    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].imageUrl).toBe(
      'https://cdn.test/milk.jpg',
    );
    expect(result.current.hasSuggestions).toBe(true);
  });

  it('returns null imageUrl when suggestion has no image', () => {
    mockQueryResult.data = {
      pantry: {
        suggestions: [createSuggestion({ imageUrl: null })],
      },
    };

    const { result } = renderHook(() =>
      usePantryItemSuggestions({ pantryId: 'pantry-1' }),
    );

    expect(result.current.suggestions[0].imageUrl).toBeNull();
  });

  describe('grouping by source', () => {
    it('groups suggestions by PantrySuggestionSource', () => {
      mockQueryResult.data = {
        pantry: {
          suggestions: [
            createSuggestion({ id: '1', source: PantrySuggestionSource.LowStock }),
            createSuggestion({ id: '2', source: PantrySuggestionSource.ExpiringSoon }),
            createSuggestion({ id: '3', source: PantrySuggestionSource.LowStock }),
            createSuggestion({ id: '4', source: PantrySuggestionSource.Popular }),
            createSuggestion({ id: '5', source: PantrySuggestionSource.FrequentlyAdded }),
            createSuggestion({ id: '6', source: PantrySuggestionSource.RecentlyDeleted }),
          ],
        },
      };

      const { result } = renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(result.current.grouped.lowStock).toHaveLength(2);
      expect(result.current.grouped.expiringSoon).toHaveLength(1);
      expect(result.current.grouped.popular).toHaveLength(1);
      expect(result.current.grouped.frequentlyAdded).toHaveLength(1);
      expect(result.current.grouped.recentlyDeleted).toHaveLength(1);
    });

    it('returns empty groups when no suggestions', () => {
      const { result } = renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(result.current.grouped.lowStock).toHaveLength(0);
      expect(result.current.grouped.expiringSoon).toHaveLength(0);
      expect(result.current.grouped.popular).toHaveLength(0);
      expect(result.current.grouped.frequentlyAdded).toHaveLength(0);
      expect(result.current.grouped.recentlyDeleted).toHaveLength(0);
    });
  });

  describe('offline behavior', () => {
    it('returns empty suggestions when offline', () => {
      mockIsOffline = true;
      mockQueryResult.data = {
        pantry: {
          suggestions: [createSuggestion()],
        },
      };

      const { result } = renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.hasSuggestions).toBe(false);
      expect(result.current.isOffline).toBe(true);
    });
  });

  describe('image preloading', () => {
    it('preloads images when suggestions have URLs', () => {
      mockQueryResult.data = {
        pantry: {
          suggestions: [
            createSuggestion({ id: '1', imageUrl: 'img1.jpg' }),
            createSuggestion({ id: '2', imageUrl: 'img2.jpg' }),
            createSuggestion({ id: '3', imageUrl: null }),
          ],
        },
      };

      renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(mockPreloadImages).toHaveBeenCalledWith([
        'https://cdn.test/img1.jpg',
        'https://cdn.test/img2.jpg',
      ]);
    });

    it('does not preload when no suggestions', () => {
      renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(mockPreloadImages).not.toHaveBeenCalled();
    });
  });

  describe('query configuration', () => {
    it('skips query when pantryId is undefined', () => {
      const { useGetPantryItemSuggestionsQuery } =
        jest.requireMock('#generated');

      renderHook(() =>
        usePantryItemSuggestions({ pantryId: undefined }),
      );

      expect(useGetPantryItemSuggestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips query when skip option is true', () => {
      const { useGetPantryItemSuggestionsQuery } =
        jest.requireMock('#generated');

      renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1', skip: true }),
      );

      expect(useGetPantryItemSuggestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips query when offline', () => {
      mockIsOffline = true;
      const { useGetPantryItemSuggestionsQuery } =
        jest.requireMock('#generated');

      renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(useGetPantryItemSuggestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('uses default limit of 10', () => {
      const { useGetPantryItemSuggestionsQuery } =
        jest.requireMock('#generated');

      renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(useGetPantryItemSuggestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { pantryId: 'pantry-1', limit: 10 },
        }),
      );
    });

    it('uses custom limit when provided', () => {
      const { useGetPantryItemSuggestionsQuery } =
        jest.requireMock('#generated');

      renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1', limit: 5 }),
      );

      expect(useGetPantryItemSuggestionsQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: { pantryId: 'pantry-1', limit: 5 },
        }),
      );
    });
  });

  describe('loading and error', () => {
    it('exposes loading state from query', () => {
      mockQueryResult.loading = true;

      const { result } = renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(result.current.loading).toBe(true);
    });

    it('exposes error from query', () => {
      const error = { message: 'Failed' };
      mockQueryResult.error = error as any;

      const { result } = renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(result.current.error).toBe(error);
    });

    it('exposes refetch function', () => {
      const { result } = renderHook(() =>
        usePantryItemSuggestions({ pantryId: 'pantry-1' }),
      );

      expect(result.current.refetch).toBe(mockQueryResult.refetch);
    });
  });
});
