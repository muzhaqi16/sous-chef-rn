import { act, waitFor } from '@testing-library/react-native';

import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeCacheStore } from '#/store/useRecipeCacheStore';
import { useRecipeScreen } from '../useRecipeScreen';

// ── Mock external Spoonacular HTTP service ──
const mockSearchRecipes = jest.fn();
const mockSearchRecipesByIngredients = jest.fn();
const mockGetRandomRecipes = jest.fn();
const mockGetBulkRecipeInformation = jest.fn();

jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipes: (...args: unknown[]) => mockSearchRecipes(...args),
    searchRecipesWithInfo: (...args: unknown[]) => {
      const [params, ...rest] = args;
      return mockSearchRecipes(
        { ...(params as object), addRecipeInformation: true },
        ...rest,
      );
    },
    searchRecipesByIngredients: (...args: unknown[]) =>
      mockSearchRecipesByIngredients(...args),
    getRandomRecipes: (...args: unknown[]) => mockGetRandomRecipes(...args),
    getBulkRecipeInformation: (...args: unknown[]) =>
      mockGetBulkRecipeInformation(...args),
  },
}));

// ── Mock alert service (assertions on user-facing alerts) ──
const mockAlert = jest.fn();
jest.mock('#/services/alertService', () => ({
  alertService: {
    alert: (...args: unknown[]) => mockAlert(...args),
  },
}));

// ── Mock useAppStore (selector + getState) ──
const appStoreState = { user: { id: 'user-123' } };
jest.mock('#store/useAppStore', () => {
  const useAppStore = jest.fn((selector: (s: unknown) => unknown) =>
    selector(appStoreState),
  );
  // @ts-expect-error attach API
  useAppStore.getState = jest.fn(() => appStoreState);
  return {
    __esModule: true,
    useAppStore,
    useUser: jest.fn(() => appStoreState.user),
    useUserId: jest.fn(() => appStoreState.user?.id),
    useSelectedPantryId: jest.fn(() => 'pantry-1'),
    useSelectedHomeId: jest.fn(() => 'home-1'),
    useIsLoggingOut: jest.fn(() => false),
  };
});

// ── Mock useDietaryProfile (its own Apollo internals are tested elsewhere) ──
const mockUseDietaryProfile = jest.fn();
jest.mock('#features/profile/hooks/useDietaryProfile', () => ({
  useDietaryProfile: () => mockUseDietaryProfile(),
}));

// ── Mock useRecipeDiscovery (composed sub-hook with its own tests) ──
const mockDiscoveryRefresh = jest.fn();
const mockLoadMorePantryItems = jest.fn();
const mockLoadMoreDiscovery = jest.fn();
const mockUseRecipeDiscovery = jest.fn();
jest.mock('#features/recipes/hooks/useRecipeDiscovery', () => ({
  useRecipeDiscovery: (...args: unknown[]) => mockUseRecipeDiscovery(...args),
}));

// ── Default discovery state factory ──
function makeDiscovery(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'random',
    items: [],
    loading: false,
    refresh: mockDiscoveryRefresh,
    pantryItems: [],
    hasPantryItems: false,
    pantryHasMore: false,
    pantryLoadingMore: false,
    loadMorePantryItems: mockLoadMorePantryItems,
    discoveryHasMore: false,
    loadMoreDiscovery: mockLoadMoreDiscovery,
    ...overrides,
  };
}

// Sample discovery item shape — mirrors DiscoveryItem
const sampleDiscoveryItem = {
  id: 'disc-1',
  title: 'Sample Random Recipe',
  subtitle: '4 servings • 30 min',
  badge: { text: 'Suggested' },
  imageUrl: 'https://img/disc-1.jpg',
  spoonacularId: 1234,
};

// Sample text-search Spoonacular response (SearchRecipesResult shape)
const sampleTextSearchResponse = {
  results: [
    {
      id: 7001,
      title: 'Pasta Carbonara',
      image: 'https://img/7001.jpg',
      imageType: 'jpg',
      readyInMinutes: 25,
      servings: 4,
      aggregateLikes: 12,
      vegan: false,
      vegetarian: false,
      glutenFree: false,
      dairyFree: false,
    },
    {
      id: 7002,
      title: 'Margherita Pizza',
      image: 'https://img/7002.jpg',
      imageType: 'jpg',
      readyInMinutes: 40,
      servings: 2,
      aggregateLikes: 8,
      vegan: false,
      vegetarian: true,
      glutenFree: false,
      dairyFree: false,
    },
  ],
  offset: 0,
  number: 2,
  totalResults: 2,
};

// Sample ingredient-search response (RecipeSearchResult shape)
const sampleIngredientSearchResponse = [
  {
    id: 8001,
    title: 'Tomato Soup',
    image: 'https://img/8001.jpg',
    imageType: 'jpg',
    usedIngredientCount: 2,
    missedIngredientCount: 1,
    missedIngredients: [],
    usedIngredients: [],
    unusedIngredients: [],
    likes: 5,
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  // Reset cache store between tests so cached results from prior tests
  // don't leak across test boundaries.
  useRecipeCacheStore.getState().clearAllCache();

  mockUseDietaryProfile.mockReturnValue({ profile: null, loading: false });
  mockUseRecipeDiscovery.mockReturnValue(makeDiscovery());
});

describe('useRecipeScreen', () => {
  it('exposes initial state shape', () => {
    const { result } = renderHookWithApollo(() => useRecipeScreen());

    expect(result.current.userId).toBe('user-123');
    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchPerformed).toBe(false);
    expect(result.current.searchLoading).toBe(false);
    expect(result.current.items).toEqual([]);
    expect(result.current.selectedIngredients.size).toBe(0);
    expect(result.current.activeFilters).toEqual({
      diet: [],
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    });
    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.showSearchResults).toBe(false);
    expect(result.current.showDiscovery).toBe(false);
    expect(result.current.emptyStateConfig.title).toBe('Discover Recipes');
  });

  it('shows discovery items when discovery has results and no search performed', () => {
    mockUseRecipeDiscovery.mockReturnValue(
      makeDiscovery({ items: [sampleDiscoveryItem] }),
    );

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    expect(result.current.showDiscovery).toBe(true);
    expect(result.current.items).toEqual([sampleDiscoveryItem]);
  });

  it('syncs filters from dietary profile on first load', () => {
    mockUseDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [
          { id: 'r1', diet: 'VEGAN' },
          { id: 'r2', intolerance: 'GLUTEN' },
        ],
        maxCookTimeMinutes: 30,
      },
      loading: false,
    });

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    expect(result.current.activeFilters.diet).toEqual(['vegan']);
    expect(result.current.activeFilters.intolerances).toEqual(['gluten']);
    expect(result.current.activeFilters.maxReadyTime).toBe(30);
    // diet (1) + intolerance (1) + maxReadyTime (1) = 3
    expect(result.current.activeFilterCount).toBe(3);
  });

  it('clearFilters resets active filters to defaults', () => {
    mockUseDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [{ id: 'r1', diet: 'VEGAN' }],
        maxCookTimeMinutes: 30,
      },
      loading: false,
    });

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    expect(result.current.activeFilterCount).toBe(2);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.activeFilterCount).toBe(0);
    expect(result.current.activeFilters).toEqual({
      diet: [],
      intolerances: [],
      mealType: null,
      maxReadyTime: null,
    });
  });

  it('toggleIngredient adds and removes ingredients from the selection', () => {
    const { result } = renderHookWithApollo(() => useRecipeScreen());

    act(() => {
      result.current.toggleIngredient('Tomato');
    });
    expect(result.current.selectedIngredients.has('Tomato')).toBe(true);

    act(() => {
      result.current.toggleIngredient('Onion');
    });
    expect(result.current.selectedIngredients.size).toBe(2);

    act(() => {
      result.current.toggleIngredient('Tomato');
    });
    expect(result.current.selectedIngredients.has('Tomato')).toBe(false);
    expect(result.current.selectedIngredients.has('Onion')).toBe(true);

    act(() => {
      result.current.clearSelectedIngredients();
    });
    expect(result.current.selectedIngredients.size).toBe(0);
  });

  it('handleTextSearch calls Spoonacular and populates transformed results', async () => {
    mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    await waitFor(() => {
      expect(result.current.searchPerformed).toBe(true);
      expect(result.current.searchLoading).toBe(false);
    });

    expect(mockSearchRecipes).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'pasta', addRecipeInformation: true }),
    );
    expect(result.current.searchResults).toHaveLength(2);
    // Transform: SearchRecipesResult ids prefixed with 'spoonacular-'
    expect(result.current.searchResults[0].id).toBe('spoonacular-7001');
    expect(result.current.searchResults[0].title).toBe('Pasta Carbonara');
    expect(result.current.showSearchResults).toBe(true);
    expect(result.current.items[0].id).toBe('spoonacular-7001');
  });

  it('handleTextSearch is a no-op for empty/whitespace queries', async () => {
    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleTextSearch('   ');
    });

    expect(mockSearchRecipes).not.toHaveBeenCalled();
    expect(result.current.searchPerformed).toBe(false);
  });

  it('handleTextSearch surfaces a quota error via alertService', async () => {
    const quotaError = Object.assign(new Error('quota'), {
      isQuotaExceeded: true,
    });
    mockSearchRecipes.mockRejectedValueOnce(quotaError);

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    await waitFor(() => {
      expect(result.current.searchLoading).toBe(false);
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'API Limit Reached',
      expect.stringContaining('quota exceeded'),
    );
    expect(result.current.searchPerformed).toBe(true);
    expect(result.current.searchResults).toEqual([]);
  });

  it('handleIngredientSearch alerts when no ingredients are selected', async () => {
    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'No Ingredients Selected',
      expect.stringContaining('Please select'),
    );
    expect(mockSearchRecipesByIngredients).not.toHaveBeenCalled();
  });

  it('handleIngredientSearch fires Spoonacular with the joined ingredient string', async () => {
    mockSearchRecipesByIngredients.mockResolvedValueOnce(
      sampleIngredientSearchResponse,
    );

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    act(() => {
      result.current.toggleIngredient('Tomato');
      result.current.toggleIngredient('Basil');
    });

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(mockSearchRecipesByIngredients).toHaveBeenCalledTimes(1);
    const callArg = mockSearchRecipesByIngredients.mock.calls[0][0] as {
      ingredients: string;
    };
    // Set iteration order is insertion order — both ingredients must be present
    expect(callArg.ingredients.split(',').sort()).toEqual(['Basil', 'Tomato']);

    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(1);
    });
    expect(result.current.searchResults[0].title).toBe('Tomato Soup');
    expect(result.current.searchResults[0].id).toBe('spoonacular-8001');
  });

  it('clearSearch resets search state but preserves discovery', () => {
    mockUseRecipeDiscovery.mockReturnValue(
      makeDiscovery({ items: [sampleDiscoveryItem] }),
    );
    mockSearchRecipes.mockResolvedValue(sampleTextSearchResponse);

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    // Perform a search first
    return (async () => {
      await act(async () => {
        await result.current.handleTextSearch('pizza');
      });

      expect(result.current.searchPerformed).toBe(true);
      expect(result.current.searchResults).toHaveLength(2);

      act(() => {
        result.current.clearSearch();
      });

      expect(result.current.searchQuery).toBe('');
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchPerformed).toBe(false);
      // Discovery items reappear
      expect(result.current.showDiscovery).toBe(true);
      expect(result.current.items).toEqual([sampleDiscoveryItem]);
    })();
  });

  it('handleRefresh re-runs the last text search when one was performed', async () => {
    mockSearchRecipes.mockResolvedValue(sampleTextSearchResponse);

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });
    expect(mockSearchRecipes).toHaveBeenCalledTimes(1);

    // Cached on first call — refresh should still call again because cache is
    // keyed on query+filters and serves the same result, but the helper is
    // re-invoked via handleRefresh→executeRecipeTextSearch→cache hit.
    // Clear the cache to force a real refetch.
    act(() => {
      useRecipeCacheStore.getState().clearAllCache();
    });

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(mockSearchRecipes).toHaveBeenCalledTimes(2);
  });

  it('handleRefresh delegates to discovery.refresh when no search performed', async () => {
    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(mockDiscoveryRefresh).toHaveBeenCalledTimes(1);
    expect(mockSearchRecipes).not.toHaveBeenCalled();
  });

  it('emptyStateConfig reflects loading and post-search empty states', async () => {
    mockSearchRecipes.mockResolvedValueOnce({
      results: [],
      offset: 0,
      number: 0,
      totalResults: 0,
    });

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    expect(result.current.emptyStateConfig.title).toBe('Discover Recipes');

    await act(async () => {
      await result.current.handleTextSearch('zzznorelevantquery');
    });

    await waitFor(() => {
      expect(result.current.searchLoading).toBe(false);
    });

    expect(result.current.searchPerformed).toBe(true);
    expect(result.current.emptyStateConfig.title).toBe('No recipes found');
  });

  it('uses cached search results on a repeated query without hitting the API again', async () => {
    mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

    const { result } = renderHookWithApollo(() => useRecipeScreen());

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });
    expect(mockSearchRecipes).toHaveBeenCalledTimes(1);

    // Clear results so we can prove the cache path repopulated them
    act(() => {
      result.current.clearSearch();
    });

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    // Still only 1 call — second invocation served from cache
    expect(mockSearchRecipes).toHaveBeenCalledTimes(1);
    expect(result.current.searchResults).toHaveLength(2);
    expect(result.current.searchPerformed).toBe(true);
  });
});
