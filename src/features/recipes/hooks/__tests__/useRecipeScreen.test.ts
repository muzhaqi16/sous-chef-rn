import { act, waitFor } from '@testing-library/react-native';

import {
  renderHookWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useRecipeCacheStore } from '#features/recipes/store/useRecipeCacheStore';
import { SearchRecipesDocument } from '#features/recipes/graphql/recipe.generated';
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

// ── Local GraphQL SearchRecipes mocks ──
// Node fixtures must include every field the document selects: the inline
// display fields plus all BasicRecipeFragment fields (Apollo can't cache
// partially-specified entities in operationMocks).
function makeLocalRecipeNode(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'Recipe',
    id: 'r1',
    name: 'Family Lasagna',
    description: null,
    imageUrl: 'https://img/local-r1.jpg',
    servings: 6,
    prepTimeMinutes: 20,
    cookTimeMinutes: 40,
    totalTimeMinutes: 60,
    difficulty: null,
    category: null,
    cuisine: null,
    status: 'PUBLISHED',
    isExternal: false,
    externalSource: null,
    externalId: null,
    isSaved: false,
    primarySource: null,
    caloriesPerServing: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    savedDetails: null,
    ...overrides,
  };
}

function searchRecipesMockWith(
  nodes: Record<string, unknown>[],
): MockedResponse {
  return {
    request: { query: SearchRecipesDocument, variables: () => true },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        searchRecipes: {
          __typename: 'RecipeConnection',
          edges: nodes.map(node => ({
            __typename: 'RecipeEdge',
            cursor: `cursor-${node.id}`,
            node,
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: false,
            endCursor: null,
          },
          totalCount: nodes.length,
        },
      },
    },
  };
}

/** Catch-all local-API mock returning no recipes — the default for tests that
 * focus on the Spoonacular half of the combined search. */
function emptySearchRecipesMock(): MockedResponse {
  return searchRecipesMockWith([]);
}

/** Page-aware local-API mock: matches a specific `after` cursor (or its
 * absence for page 1) so distinct pages can return distinct nodes, and lets
 * the test set the returned `pageInfo`. Records every variables payload Apollo
 * sent into `fired` so the test can assert the load-more `after`. */
function searchRecipesPageMock(opts: {
  matchAfter: string | null;
  nodes: Record<string, unknown>[];
  hasNextPage: boolean;
  endCursor: string | null;
  fired?: Record<string, unknown>[];
}): MockedResponse {
  return {
    request: {
      query: SearchRecipesDocument,
      variables: (vars: Record<string, unknown>) => {
        opts.fired?.push(vars);
        const after = (vars.after ?? null) as string | null;
        return after === opts.matchAfter;
      },
    },
    maxUsageCount: Number.POSITIVE_INFINITY,
    result: {
      data: {
        searchRecipes: {
          __typename: 'RecipeConnection',
          edges: opts.nodes.map(node => ({
            __typename: 'RecipeEdge',
            cursor: `cursor-${node.id}`,
            node,
          })),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: opts.hasNextPage,
            endCursor: opts.endCursor,
          },
          totalCount: opts.nodes.length,
        },
      },
    },
  };
}

/** Empty Spoonacular page — keeps a load-more test focused on the local
 * source. `totalResults: 0` means the Spoonacular branch reports nothing more. */
const emptySpoonacularResponse = {
  results: [],
  offset: 0,
  number: 0,
  totalResults: 0,
};

function renderRecipeScreen(
  operationMocks: MockedResponse[] = [emptySearchRecipesMock()],
) {
  return renderHookWithApollo(() => useRecipeScreen(), { operationMocks });
}

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
    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

    expect(result.current.activeFilters.diet).toEqual(['vegan']);
    expect(result.current.activeFilters.intolerances).toEqual(['gluten']);
    expect(result.current.activeFilters.maxReadyTime).toBe(30);
    // diet (1) + intolerance (1) + maxReadyTime (1) = 3
    expect(result.current.activeFilterCount).toBe(3);
  });

  it('reconciles multiple diet restrictions to one lifestyle + constraints', () => {
    mockUseDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [
          { id: 'r1', diet: 'VEGAN' }, // first lifestyle — kept
          { id: 'r2', diet: 'PESCETARIAN' }, // second lifestyle — dropped
          { id: 'r3', diet: 'GLUTEN_FREE' }, // constraint — kept
        ],
        maxCookTimeMinutes: null,
      },
      loading: false,
    });

    const { result } = renderRecipeScreen();

    // Contradictory second lifestyle diet dropped; constraint stacked on.
    expect(result.current.activeFilters.diet).toEqual(['vegan', 'gluten free']);
  });

  it('clearFilters resets active filters to defaults', () => {
    mockUseDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [{ id: 'r1', diet: 'VEGAN' }],
        maxCookTimeMinutes: 30,
      },
      loading: false,
    });

    const { result } = renderRecipeScreen();

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
    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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
    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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
    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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
    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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

    const { result } = renderRecipeScreen();

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

  it('does not cache empty Spoonacular responses — a retry hits the API again', async () => {
    mockSearchRecipes.mockResolvedValue({
      results: [],
      offset: 0,
      number: 0,
      totalResults: 0,
    });

    const { result } = renderRecipeScreen();

    await act(async () => {
      await result.current.handleTextSearch('zzznothing');
    });
    expect(mockSearchRecipes).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.handleTextSearch('zzznothing');
    });

    // Empty result was not cached, so the same query fires the API again
    expect(mockSearchRecipes).toHaveBeenCalledTimes(2);
  });

  describe('combined local + Spoonacular search', () => {
    it('shows local results first, then Spoonacular results', async () => {
      mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

      const { result } = renderRecipeScreen([
        searchRecipesMockWith([makeLocalRecipeNode()]),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('lasagna');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'local-r1',
        'spoonacular-7001',
        'spoonacular-7002',
      ]);
      expect(result.current.searchResults[0].title).toBe('Family Lasagna');
      // Backend results are the app's recipe corpus, not the user's own —
      // a non-saved result with no live match carries no badge.
      expect(result.current.searchResults[0].badge).toBeUndefined();
      expect(result.current.searchResults[0].subtitle).toContain('60');
    });

    it('dedupes Spoonacular results that share a backend title', async () => {
      mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

      // Backend recipe shares "Pasta Carbonara" with Spoonacular 7001 but has
      // no external-id link — the title guard must still drop the duplicate.
      const { result } = renderRecipeScreen([
        searchRecipesMockWith([
          makeLocalRecipeNode({ id: 'r-pc', name: 'Pasta Carbonara' }),
        ]),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('carbonara');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      // 'Pasta Carbonara' appears only as the local entry; 7002 stays
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'local-r-pc',
        'spoonacular-7002',
      ]);
    });

    it('enriches a backend result with time + likes from its live Spoonacular match', async () => {
      mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

      // Imported backend recipe with no stored time, sharing a title with
      // Spoonacular 7001 (readyInMinutes 25, aggregateLikes 12).
      const { result } = renderRecipeScreen([
        searchRecipesMockWith([
          makeLocalRecipeNode({
            id: 'r-pc',
            name: 'Pasta Carbonara',
            totalTimeMinutes: null,
          }),
        ]),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('carbonara');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      const local = result.current.searchResults.find(
        r => r.id === 'local-r-pc',
      );
      expect(local?.subtitle).toContain('25'); // readyInMinutes from the match
      expect(local?.badge?.text).toBe('❤️ 12'); // aggregateLikes from the match
    });

    it('keeps the Saved badge over likes when a matched backend result is saved', async () => {
      mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

      const { result } = renderRecipeScreen([
        searchRecipesMockWith([
          makeLocalRecipeNode({
            id: 'r-pc',
            name: 'Pasta Carbonara',
            isSaved: true,
          }),
        ]),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('carbonara');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      const local = result.current.searchResults.find(
        r => r.id === 'local-r-pc',
      );
      expect(local?.badge?.text).toBe('Saved');
    });

    it('shows local results without an alert when Spoonacular fails', async () => {
      mockSearchRecipes.mockRejectedValueOnce(new Error('network down'));

      const { result } = renderRecipeScreen([
        searchRecipesMockWith([makeLocalRecipeNode()]),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('lasagna');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      expect(mockAlert).not.toHaveBeenCalled();
      expect(result.current.searchResults.map(r => r.id)).toEqual(['local-r1']);
    });

    it('alerts exactly once when Spoonacular fails and no local results exist', async () => {
      mockSearchRecipes.mockRejectedValueOnce(new Error('network down'));

      const { result } = renderRecipeScreen();

      await act(async () => {
        await result.current.handleTextSearch('lasagna');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      expect(mockAlert).toHaveBeenCalledTimes(1);
      expect(result.current.searchResults).toEqual([]);
    });

    it('dedupes Spoonacular results the backend already knows about', async () => {
      mockSearchRecipes.mockResolvedValueOnce(sampleTextSearchResponse);

      // The backend has already upserted Spoonacular recipe 7001
      const { result } = renderRecipeScreen([
        searchRecipesMockWith([
          makeLocalRecipeNode({
            id: 'r-ext',
            name: 'Pasta Carbonara (saved)',
            isExternal: true,
            externalSource: 'SPOONACULAR',
            externalId: '7001',
          }),
        ]),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('carbonara');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      // 7001 appears only as the local entry; 7002 stays
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'local-r-ext',
        'spoonacular-7002',
      ]);
    });
  });

  describe('text-search pagination (load more)', () => {
    it('loadMoreSearch fetches the next local page with the end cursor and appends', async () => {
      // Spoonacular contributes nothing here so the assertions isolate the
      // local pagination path.
      mockSearchRecipes.mockResolvedValue(emptySpoonacularResponse);

      const fired: Record<string, unknown>[] = [];
      const page1 = searchRecipesPageMock({
        matchAfter: null,
        nodes: [
          makeLocalRecipeNode({ id: 'r1', name: 'Lasagna One' }),
          makeLocalRecipeNode({ id: 'r2', name: 'Lasagna Two' }),
        ],
        hasNextPage: true,
        endCursor: 'cursor-page1-end',
        fired,
      });
      const page2 = searchRecipesPageMock({
        matchAfter: 'cursor-page1-end',
        nodes: [makeLocalRecipeNode({ id: 'r3', name: 'Lasagna Three' })],
        hasNextPage: false,
        endCursor: null,
        fired,
      });

      const { result } = renderRecipeScreen([page1, page2]);

      await act(async () => {
        await result.current.handleTextSearch('lasagna');
      });
      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      // First page on screen; more remains because pageInfo.hasNextPage is true.
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'local-r1',
        'local-r2',
      ]);
      expect(result.current.searchHasMore).toBe(true);

      await act(async () => {
        await result.current.loadMoreSearch();
      });
      await waitFor(() => {
        expect(result.current.searchResults).toHaveLength(3);
      });

      // A real second-page query was issued with the page-1 end cursor.
      const afters = fired.map(v => v.after ?? null);
      expect(afters).toContain('cursor-page1-end');

      // New page appended after the existing rows.
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'local-r1',
        'local-r2',
        'local-r3',
      ]);
      // pageInfo.hasNextPage on the second page was false → no more.
      expect(result.current.searchHasMore).toBe(false);
    });

    it('does not duplicate a recipe present in both the first and second local page', async () => {
      mockSearchRecipes.mockResolvedValue(emptySpoonacularResponse);

      const page1 = searchRecipesPageMock({
        matchAfter: null,
        nodes: [makeLocalRecipeNode({ id: 'r1', name: 'Shared Recipe' })],
        hasNextPage: true,
        endCursor: 'cursor-p1',
      });
      // Page 2 re-surfaces "Shared Recipe" (different id) plus a genuinely new
      // one. The cross-page title dedupe must drop the repeat.
      const page2 = searchRecipesPageMock({
        matchAfter: 'cursor-p1',
        nodes: [
          makeLocalRecipeNode({ id: 'r1-dup', name: 'Shared Recipe' }),
          makeLocalRecipeNode({ id: 'r2', name: 'Brand New Recipe' }),
        ],
        hasNextPage: false,
        endCursor: null,
      });

      const { result } = renderRecipeScreen([page1, page2]);

      await act(async () => {
        await result.current.handleTextSearch('shared');
      });
      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });
      expect(result.current.searchResults.map(r => r.id)).toEqual(['local-r1']);

      await act(async () => {
        await result.current.loadMoreSearch();
      });
      await waitFor(() => {
        expect(result.current.searchResults).toHaveLength(2);
      });

      // "Shared Recipe" appears once (the page-1 copy); only the new recipe is
      // appended. The page-2 duplicate id never reaches the list.
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'local-r1',
        'local-r2',
      ]);
    });

    it('searchHasMore reflects pageInfo.hasNextPage', async () => {
      mockSearchRecipes.mockResolvedValue(emptySpoonacularResponse);

      const { result } = renderRecipeScreen([
        searchRecipesPageMock({
          matchAfter: null,
          nodes: [makeLocalRecipeNode({ id: 'r1', name: 'Only Page' })],
          hasNextPage: false,
          endCursor: null,
        }),
      ]);

      await act(async () => {
        await result.current.handleTextSearch('only');
      });
      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      // No next local page and no Spoonacular results → nothing more to load.
      expect(result.current.searchResults).toHaveLength(1);
      expect(result.current.searchHasMore).toBe(false);
    });

    it('stops Spoonacular load-more when a requested page returns no rows (paging cap)', async () => {
      // Local source has just one page, so Spoonacular alone drives "load more".
      const localMock = searchRecipesPageMock({
        matchAfter: null,
        nodes: [makeLocalRecipeNode({ id: 'r1', name: 'Local Only' })],
        hasNextPage: false,
        endCursor: null,
      });

      // Page 1 returns 2 rows but advertises a far larger total (100), so
      // offset(2) < total(100) and more is offered. The next offset returns no
      // rows even though the total still says 100 — the plan's paging cap.
      mockSearchRecipes.mockImplementation((params: { offset?: number }) => {
        const offset = params.offset ?? 0;
        if (offset === 0) {
          return Promise.resolve({
            results: sampleTextSearchResponse.results,
            offset: 0,
            number: 2,
            totalResults: 100,
          });
        }
        return Promise.resolve({
          results: [],
          offset,
          number: 0,
          totalResults: 100,
        });
      });

      const { result } = renderRecipeScreen([localMock]);

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });
      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });
      // Spoonacular advertised more than it returned → load-more is offered.
      expect(result.current.searchHasMore).toBe(true);

      await act(async () => {
        await result.current.loadMoreSearch();
      });

      // The empty page freezes the Spoonacular total at the current offset, so
      // there's nothing more to load — the footer hides instead of re-firing the
      // same empty page forever (the pre-fix infinite-loop regression).
      await waitFor(() => {
        expect(result.current.searchHasMore).toBe(false);
      });
    });

    it('paginates the Spoonacular source by offset when more results remain', async () => {
      // totalResults (3) > page size (1 here) so a second Spoonacular page
      // exists. The mock returns a distinct recipe per offset.
      mockSearchRecipes.mockImplementation((params: { offset?: number }) => {
        const offset = params.offset ?? 0;
        if (offset === 0) {
          return Promise.resolve({
            results: [
              {
                id: 9001,
                title: 'Spoon One',
                image: 'https://img/9001.jpg',
                imageType: 'jpg',
                readyInMinutes: 10,
                servings: 1,
                aggregateLikes: 1,
              },
            ],
            offset: 0,
            number: 1,
            totalResults: 3,
          });
        }
        return Promise.resolve({
          results: [
            {
              id: 9002,
              title: 'Spoon Two',
              image: 'https://img/9002.jpg',
              imageType: 'jpg',
              readyInMinutes: 20,
              servings: 2,
              aggregateLikes: 2,
            },
          ],
          offset,
          number: 1,
          totalResults: 3,
        });
      });

      const { result } = renderRecipeScreen();

      await act(async () => {
        await result.current.handleTextSearch('spoon');
      });
      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-9001',
      ]);
      // offset(1) < totalResults(3) → more remains.
      expect(result.current.searchHasMore).toBe(true);

      await act(async () => {
        await result.current.loadMoreSearch();
      });
      await waitFor(() => {
        expect(result.current.searchResults).toHaveLength(2);
      });

      // Second page fetched with offset 1 (the count fetched on page 1).
      const offsets = mockSearchRecipes.mock.calls.map(
        c => (c[0] as { offset?: number }).offset,
      );
      expect(offsets).toContain(1);
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-9001',
        'spoonacular-9002',
      ]);
    });
  });

  describe('filter actions', () => {
    const veganProfile = {
      profile: {
        restrictions: [{ id: 'r1', diet: 'VEGAN' }],
        maxCookTimeMinutes: 30,
      },
      loading: false,
    };

    it('removeFilter narrows filters and re-runs the active search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      mockSearchRecipes.mockResolvedValue(sampleTextSearchResponse);

      const { result } = renderRecipeScreen();

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });
      expect(mockSearchRecipes).toHaveBeenCalledWith(
        expect.objectContaining({ diet: 'vegan', maxReadyTime: 30 }),
      );

      await act(async () => {
        result.current.removeFilter('diet', 'vegan');
      });

      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledTimes(2);
      });
      const secondCall = mockSearchRecipes.mock.calls[1][0] as Record<
        string,
        unknown
      >;
      expect(secondCall.diet).toBeUndefined();
      expect(secondCall.maxReadyTime).toBe(30);
      expect(result.current.activeFilters.diet).toEqual([]);
      expect(result.current.activeFilterCount).toBe(1);
    });

    it('clearFiltersAndSearchAgain clears all filters and re-runs the search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      mockSearchRecipes.mockResolvedValue(sampleTextSearchResponse);

      const { result } = renderRecipeScreen();

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });

      await act(async () => {
        result.current.clearFiltersAndSearchAgain();
      });

      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledTimes(2);
      });
      const secondCall = mockSearchRecipes.mock.calls[1][0] as Record<
        string,
        unknown
      >;
      expect(secondCall.diet).toBeUndefined();
      expect(secondCall.intolerances).toBeUndefined();
      expect(secondCall.maxReadyTime).toBeUndefined();
      expect(result.current.activeFilterCount).toBe(0);
    });

    it('does not re-run a search when filters change before any search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);

      const { result } = renderRecipeScreen();

      await act(async () => {
        result.current.removeFilter('maxReadyTime');
      });

      expect(mockSearchRecipes).not.toHaveBeenCalled();
      expect(result.current.activeFilters.maxReadyTime).toBeNull();
    });

    it('ingredient-search empty state does not blame filters (they never apply)', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      mockSearchRecipesByIngredients.mockResolvedValue([]);

      const { result } = renderRecipeScreen();

      act(() => {
        result.current.toggleIngredient('Durian');
      });
      await act(async () => {
        await result.current.handleIngredientSearch();
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      // Filters are active but don't apply to ingredient search — the empty
      // state must use the plain copy with no clear-filters action.
      expect(result.current.activeFilterCount).toBe(2);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.emptyStateConfig.action).toBeUndefined();
      expect(result.current.emptyStateConfig.description).not.toContain(
        'filter',
      );
    });

    it('empty state explains active filters and offers clear-and-retry', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      mockSearchRecipes.mockResolvedValue({
        results: [],
        offset: 0,
        number: 0,
        totalResults: 0,
      });

      const { result } = renderRecipeScreen();

      await act(async () => {
        await result.current.handleTextSearch('zzznothing');
      });

      await waitFor(() => {
        expect(result.current.searchLoading).toBe(false);
      });

      expect(result.current.emptyStateConfig.title).toBe('No recipes found');
      expect(result.current.emptyStateConfig.description).toContain(
        '2 dietary filters',
      );
      expect(result.current.emptyStateConfig.action?.label).toBe(
        'Clear filters & search again',
      );

      // The action clears filters and re-fires the search without them
      await act(async () => {
        result.current.emptyStateConfig.action?.onPress();
      });

      await waitFor(() => {
        expect(mockSearchRecipes).toHaveBeenCalledTimes(2);
      });
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('superseded text searches (staleness guard)', () => {
    const spoonResponse = (id: number, title: string) => ({
      results: [
        {
          id,
          title,
          image: `https://img/${id}.jpg`,
          imageType: 'jpg',
          readyInMinutes: 30,
          servings: 4,
          aggregateLikes: 1,
          vegan: false,
          vegetarian: false,
          glutenFree: false,
          dairyFree: false,
        },
      ],
      offset: 0,
      number: 1,
      totalResults: 1,
    });

    it('discards a slow search superseded by a newer one', async () => {
      // Two searches race on their Spoonacular half: "app" is fired first but
      // its response is deferred so it resolves LAST; "banana" is fired second
      // and resolves first. The stale "app" response must not clobber banana.
      let resolveApp!: (v: unknown) => void;
      let resolveBanana!: (v: unknown) => void;
      const appPromise = new Promise(res => {
        resolveApp = res;
      });
      const bananaPromise = new Promise(res => {
        resolveBanana = res;
      });

      mockSearchRecipes.mockImplementation((params: { query?: string }) => {
        if (params.query === 'app') return appPromise;
        if (params.query === 'banana') return bananaPromise;
        return Promise.resolve(emptySpoonacularResponse);
      });

      const { result } = renderRecipeScreen();

      let appDone!: Promise<void>;
      let bananaDone!: Promise<void>;

      // Fire both searches; each blocks on its deferred Spoonacular promise.
      await act(async () => {
        appDone = result.current.handleTextSearch('app');
        bananaDone = result.current.handleTextSearch('banana');
      });

      // The NEWER search ("banana") resolves first and commits its results.
      await act(async () => {
        resolveBanana(spoonResponse(2222, 'Banana Bread'));
        await bananaDone;
      });

      expect(result.current.searchQuery).toBe('banana');
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-2222',
      ]);

      // The STALE search ("app") resolves last — it must be discarded, not
      // overwrite the banana results, pagination, or the loading flag.
      await act(async () => {
        resolveApp(spoonResponse(1111, 'Apple Pie'));
        await appDone;
      });

      expect(result.current.searchQuery).toBe('banana');
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-2222',
      ]);
      expect(result.current.searchLoading).toBe(false);
    });

    it('a search cleared mid-flight does not repopulate the list on resolve', async () => {
      let resolvePending!: (v: unknown) => void;
      const pending = new Promise(res => {
        resolvePending = res;
      });
      mockSearchRecipes.mockImplementation((params: { query?: string }) =>
        params.query === 'soup'
          ? pending
          : Promise.resolve(emptySpoonacularResponse),
      );

      const { result } = renderRecipeScreen();

      let searchDone!: Promise<void>;
      await act(async () => {
        searchDone = result.current.handleTextSearch('soup');
      });

      // The search is in flight, so the spinner is showing.
      expect(result.current.searchLoading).toBe(true);

      // User clears the search before the in-flight response lands.
      act(() => {
        result.current.clearSearch();
      });
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchPerformed).toBe(false);
      // Clearing mid-flight must drop the loading flag — otherwise the empty
      // state stays stuck on the "searching…" spinner.
      expect(result.current.searchLoading).toBe(false);

      // The stale response resolves — the cleared list must stay empty and the
      // superseded search must not resurrect the loading flag.
      await act(async () => {
        resolvePending(spoonResponse(3333, 'Tomato Soup'));
        await searchDone;
      });

      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchPerformed).toBe(false);
      expect(result.current.searchLoading).toBe(false);
    });

    it('discards an in-flight text search superseded by an ingredient search', async () => {
      // The text search's Spoonacular half is deferred so it resolves LAST; an
      // ingredient search fired after it must win and the stale text response
      // must not clobber the ingredient results.
      let resolveText!: (v: unknown) => void;
      const textPending = new Promise(res => {
        resolveText = res;
      });
      mockSearchRecipes.mockImplementation((params: { query?: string }) =>
        params.query === 'pasta'
          ? textPending
          : Promise.resolve(emptySpoonacularResponse),
      );
      mockSearchRecipesByIngredients.mockResolvedValueOnce(
        sampleIngredientSearchResponse,
      );

      const { result } = renderRecipeScreen();
      act(() => {
        result.current.toggleIngredient('Tomato');
      });

      let textDone!: Promise<void>;
      await act(async () => {
        textDone = result.current.handleTextSearch('pasta');
      });
      expect(result.current.searchLoading).toBe(true);

      // The ingredient search supersedes the in-flight text search and commits.
      await act(async () => {
        await result.current.handleIngredientSearch();
      });
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-8001',
      ]);

      // The stale text response resolves last — it must be discarded.
      await act(async () => {
        resolveText(spoonResponse(1111, 'Pasta'));
        await textDone;
      });
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-8001',
      ]);
      expect(result.current.searchLoading).toBe(false);
    });

    it('discards an in-flight ingredient search superseded by a text search', async () => {
      // The ingredient search's Spoonacular half is deferred so it resolves
      // LAST; a text search fired after it must win and the stale ingredient
      // response must not clobber the text results.
      let resolveIngredient!: (v: unknown) => void;
      const ingredientPending = new Promise(res => {
        resolveIngredient = res;
      });
      mockSearchRecipesByIngredients.mockImplementation(
        () => ingredientPending,
      );
      mockSearchRecipes.mockImplementation((params: { query?: string }) =>
        params.query === 'pizza'
          ? Promise.resolve(spoonResponse(7002, 'Margherita Pizza'))
          : Promise.resolve(emptySpoonacularResponse),
      );

      const { result } = renderRecipeScreen();
      act(() => {
        result.current.toggleIngredient('Tomato');
      });

      let ingredientDone!: Promise<void>;
      await act(async () => {
        ingredientDone = result.current.handleIngredientSearch();
      });
      expect(result.current.searchLoading).toBe(true);

      // The text search supersedes the in-flight ingredient search and commits.
      await act(async () => {
        await result.current.handleTextSearch('pizza');
      });
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-7002',
      ]);

      // The stale ingredient response resolves last — it must be discarded.
      await act(async () => {
        resolveIngredient(sampleIngredientSearchResponse);
        await ingredientDone;
      });
      expect(result.current.searchResults.map(r => r.id)).toEqual([
        'spoonacular-7002',
      ]);
      expect(result.current.searchLoading).toBe(false);
    });
  });
});
