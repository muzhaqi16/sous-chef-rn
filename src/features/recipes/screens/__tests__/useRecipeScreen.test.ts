import { act, waitFor } from '@testing-library/react-native';
import { CombinedGraphQLErrors } from '@apollo/client';
import { alertService } from '#/services/alertService';
import { toastService } from '#/services/toastService';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { useStore } from '#store';
import {
  Diet,
  ExternalSource,
  Intolerance,
  RecipeCategory,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import { SearchRecipesDocument } from '#features/recipes/hooks/useRecipeSearch.generated';
import { CatalogRecipesByIngredientsDocument } from '#features/recipes/hooks/useCatalogDiscovery.generated';
import { useRecipeScreen } from '../useRecipeScreen';

const mockAlert = jest.mocked(alertService.alert);
const mockToastInfo = jest.mocked(toastService.info);

// ── Mock useAppStore (selector + getState) ──
const appStoreState = {
  user: { id: 'user-123' },
  // The network fields the offline empty state reads. Absent, `isApiUnavailable`
  // reads `undefined` as "offline" and every case renders the offline state.
  isOnline: true,
  apiReachable: true as boolean | null,
  offlineModeEnabled: false,
};
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

function makeDiscovery(overrides: Record<string, unknown> = {}) {
  return {
    mode: 'random',
    rows: [],
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

// A random suggestion as discovery keeps it, and as the list then shows it.
const sampleDiscoveryRow = {
  source: 'random',
  hit: {
    __typename: 'CatalogRecipeHit',
    provider: ExternalSource.Spoonacular,
    providerRecipeId: '1234',
    name: 'Sample Random Recipe',
    imageUrl: 'https://img/disc-1.jpg',
    servings: 4,
    totalTimeMinutes: 30,
    likes: null,
  },
};
const sampleDiscoveryItem = {
  id: 'catalog-SPOONACULAR-1234',
  title: 'Sample Random Recipe',
  subtitle: '⏱ 30 min • 4 servings',
  badge: { text: 'Suggested' },
  imageUrl: 'https://img/disc-1.jpg',
  target: {
    catalog: {
      provider: ExternalSource.Spoonacular,
      externalId: '1234',
      name: 'Sample Random Recipe',
      imageUrl: 'https://img/disc-1.jpg',
    },
  },
};

// ── SearchRecipes (findRecipes) fixtures ──
type Found = NonNullable<
  MockDataFor<typeof SearchRecipesDocument>['findRecipes']
>;
type FoundEdge = NonNullable<NonNullable<Found['edges']>[number]>;

const held = (id: string, name: string): FoundEdge => ({
  cursor: `c-${id}`,
  node: {
    __typename: 'Recipe',
    id,
    name,
    imageUrl: null,
    servings: 4,
    totalTimeMinutes: 60,
    isSaved: false,
  },
});

const hit = (providerRecipeId: string, name: string): FoundEdge => ({
  cursor: `c-${providerRecipeId}`,
  node: {
    __typename: 'CatalogRecipeHit',
    provider: ExternalSource.Spoonacular,
    providerRecipeId,
    name,
    imageUrl: `https://img/${providerRecipeId}.jpg`,
    servings: 2,
    totalTimeMinutes: 25,
    likes: 12,
  },
});

const page = (
  edges: FoundEdge[],
  {
    endCursor = null,
    hasNextPage = false,
    catalogAvailable = true,
  }: {
    endCursor?: string | null;
    hasNextPage?: boolean;
    catalogAvailable?: boolean;
  } = {},
): MockDataFor<typeof SearchRecipesDocument> => ({
  findRecipes: {
    edges,
    pageInfo: { endCursor, hasNextPage },
    catalogAvailable,
  },
});

/** Every search answers with `data`, whatever its terms. */
const searchAnswering = (data: MockDataFor<typeof SearchRecipesDocument>) =>
  recordMock(SearchRecipesDocument, { data });

/** One answer per query text; the rest answer an empty page. */
const searchByQuery = (
  answers: Record<string, MockDataFor<typeof SearchRecipesDocument>>,
) =>
  recordMock(SearchRecipesDocument, {
    dataFor: vars => answers[String(vars.query)] ?? page([]),
  });

const ingredientsAnswering = (
  edges: Array<{
    used: number;
    missed: number;
    providerRecipeId: string;
    name: string;
  }>,
  waitForRelease = false,
) =>
  recordMock(CatalogRecipesByIngredientsDocument, {
    data: {
      catalogRecipesByIngredients: {
        edges: edges.map(edge => ({
          usedIngredientCount: edge.used,
          missedIngredientCount: edge.missed,
          node: {
            provider: ExternalSource.Spoonacular,
            providerRecipeId: edge.providerRecipeId,
            name: edge.name,
          },
        })),
        catalogAvailable: true,
      },
    },
    held: waitForRelease,
  });

function renderRecipeScreen(
  operationMocks: MockedResponse[] = [searchAnswering(page([])).mock],
) {
  return renderHookWithApollo(() => useRecipeScreen(), { operationMocks });
}

const ids = (items: ReadonlyArray<{ id: string }>) => items.map(i => i.id);

beforeEach(() => {
  jest.clearAllMocks();
  useStore.setState({ isOnline: true, apiReachable: true });
  mockUseDietaryProfile.mockReturnValue({ profile: null, loading: false });
  mockUseRecipeDiscovery.mockReturnValue(makeDiscovery());
});

describe('useRecipeScreen', () => {
  // Discovery and search both need the network; "no recipes found" offline
  // blames the library for the connection.
  it('shows the offline empty state when the API is unreachable', () => {
    appStoreState.apiReachable = false;
    try {
      const { result } = renderRecipeScreen();
      expect(result.current.emptyStateConfig.title).toBe(
        'Not available offline',
      );
    } finally {
      appStoreState.apiReachable = true;
    }
  });

  it('exposes initial state shape', () => {
    const { result } = renderRecipeScreen();

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
      makeDiscovery({ rows: [sampleDiscoveryRow] }),
    );

    const { result } = renderRecipeScreen();

    expect(result.current.showDiscovery).toBe(true);
    expect(result.current.items).toEqual([sampleDiscoveryItem]);
  });

  it('syncs filters from dietary profile on first load', () => {
    mockUseDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [
          { id: 'r1', diet: Diet.Vegan },
          { id: 'r2', intolerance: Intolerance.Gluten },
        ],
        maxCookTimeMinutes: 30,
      },
      loading: false,
    });

    const { result } = renderRecipeScreen();

    expect(result.current.activeFilters.diet).toEqual([Diet.Vegan]);
    expect(result.current.activeFilters.intolerances).toEqual([
      Intolerance.Gluten,
    ]);
    expect(result.current.activeFilters.maxReadyTime).toBe(30);
    // diet (1) + intolerance (1) + maxReadyTime (1) = 3
    expect(result.current.activeFilterCount).toBe(3);
  });

  it('reconciles multiple diet restrictions to one lifestyle + constraints', () => {
    mockUseDietaryProfile.mockReturnValue({
      profile: {
        restrictions: [
          { id: 'r1', diet: Diet.Vegan }, // first lifestyle — kept
          { id: 'r2', diet: Diet.Pescetarian }, // second lifestyle — dropped
          { id: 'r3', diet: Diet.GlutenFree }, // constraint — kept
          { id: 'r4', intolerance: Intolerance.Peanut },
        ],
        maxCookTimeMinutes: null,
      },
      loading: false,
    });

    const { result } = renderRecipeScreen();

    // Contradictory second lifestyle diet dropped; constraint stacked on.
    expect(result.current.activeFilters.diet).toEqual([
      Diet.Vegan,
      Diet.GlutenFree,
    ]);
    // Discovery screens by the same diets, and by the intolerances.
    expect(mockUseRecipeDiscovery).toHaveBeenLastCalledWith({
      diets: [Diet.Vegan, Diet.GlutenFree],
      intolerances: [Intolerance.Peanut],
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

  it('handleTextSearch lists the recipes the API holds, each opening its recipe', async () => {
    const search = searchAnswering(page([held('r1', 'Family Lasagna')]));
    const { result } = renderRecipeScreen([search.mock]);

    await act(async () => {
      await result.current.handleTextSearch('lasagna');
    });

    expect(search.fired).toEqual([
      { query: 'lasagna', filters: {}, first: 25, after: null },
    ]);
    expect(result.current.searchResults).toEqual([
      {
        id: 'recipe-r1',
        title: 'Family Lasagna',
        subtitle: '⏱ 60 min • 4 servings',
        badge: undefined,
        imageUrl: undefined,
        target: { recipeId: 'r1' },
      },
    ]);
    expect(result.current.showSearchResults).toBe(true);
    expect(ids(result.current.items)).toEqual(['recipe-r1']);
    expect(mockToastInfo).not.toHaveBeenCalled();
  });

  it("handleTextSearch lists the catalog's hits, each opening through the API", async () => {
    const { result } = renderRecipeScreen([
      searchAnswering(page([hit('7001', 'Pasta Carbonara')])).mock,
    ]);

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    expect(result.current.searchResults).toEqual([
      {
        id: 'catalog-SPOONACULAR-7001',
        title: 'Pasta Carbonara',
        subtitle: '⏱ 25 min • 2 servings',
        badge: { text: '❤️ 12', variant: 'primary' },
        imageUrl: 'https://img/7001.jpg',
        target: {
          catalog: {
            provider: ExternalSource.Spoonacular,
            externalId: '7001',
            name: 'Pasta Carbonara',
            imageUrl: 'https://img/7001.jpg',
          },
        },
      },
    ]);
  });

  it('handleTextSearch is a no-op for empty/whitespace queries', async () => {
    const search = searchAnswering(page([]));
    const { result } = renderRecipeScreen([search.mock]);

    await act(async () => {
      await result.current.handleTextSearch('   ');
    });

    expect(search.fired).toEqual([]);
    expect(result.current.searchPerformed).toBe(false);
  });

  it('says more recipes may appear when the catalog could not be searched', async () => {
    const { result } = renderRecipeScreen([
      searchAnswering(
        page([held('r1', 'Family Lasagna')], { catalogAvailable: false }),
      ).mock,
    ]);

    await act(async () => {
      await result.current.handleTextSearch('lasagna');
    });

    expect(ids(result.current.searchResults)).toEqual(['recipe-r1']);
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Some recipes couldn't be loaded right now. Pull down to try again.",
    );
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('alerts a failed search', async () => {
    const { result } = renderRecipeScreen([
      recordMock(SearchRecipesDocument, { error: new Error('boom') }).mock,
    ]);

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'Search Error',
      'Failed to search recipes. Please try again.',
    );
    expect(result.current.searchPerformed).toBe(true);
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchLoading).toBe(false);
  });

  it('alerts a rate limit in its own words', async () => {
    const { result } = renderRecipeScreen([
      recordMock(SearchRecipesDocument, {
        error: new CombinedGraphQLErrors({
          errors: [
            {
              message: 'limited',
              extensions: { code: TopLevelErrorCode.RateLimitExceeded },
            },
          ],
        }),
      }).mock,
    ]);

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'Rate Limit',
      'Too many requests. Please try again in a moment.',
    );
  });

  it('says offline with a toast, not an alert, when the API is unreachable', async () => {
    useStore.setState({ isOnline: false, apiReachable: false });
    const { result } = renderRecipeScreen([
      recordMock(SearchRecipesDocument, {
        error: new Error('Network request failed'),
      }).mock,
    ]);

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });

    expect(mockToastInfo).toHaveBeenCalledWith(
      'Recipe search needs a connection. Your saved recipes are still here.',
    );
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('handleIngredientSearch alerts when no ingredients are selected', async () => {
    const byIngredients = ingredientsAnswering([]);
    const { result } = renderRecipeScreen([byIngredients.mock]);

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(mockAlert).toHaveBeenCalledWith(
      'No Ingredients Selected',
      expect.stringContaining('Please select'),
    );
    expect(byIngredients.fired).toEqual([]);
  });

  it('handleIngredientSearch asks the API what the selected ingredients make', async () => {
    const byIngredients = ingredientsAnswering([
      { used: 2, missed: 1, providerRecipeId: '8001', name: 'Tomato Soup' },
    ]);
    const { result } = renderRecipeScreen([byIngredients.mock]);

    act(() => {
      result.current.toggleIngredient('Tomato');
      result.current.toggleIngredient('Basil');
    });

    await act(async () => {
      await result.current.handleIngredientSearch();
    });

    expect(byIngredients.fired).toHaveLength(1);
    const [fired] = byIngredients.fired;
    expect(
      [...((fired?.ingredients as string[] | undefined) ?? [])].sort(),
    ).toEqual(['Basil', 'Tomato']);
    const [card] = result.current.searchResults;
    expect(card?.id).toBe('catalog-SPOONACULAR-8001');
    expect(card?.title).toBe('Tomato Soup');
    expect(card?.badge?.text).toBe(
      '2 of 3 ingredients in your pantry, 1 to buy',
    );
  });

  it('clearSearch resets search state but preserves discovery', async () => {
    mockUseRecipeDiscovery.mockReturnValue(
      makeDiscovery({ rows: [sampleDiscoveryRow] }),
    );
    const { result } = renderRecipeScreen([
      searchAnswering(page([held('r1', 'Pizza')])).mock,
    ]);

    await act(async () => {
      await result.current.handleTextSearch('pizza');
    });
    expect(result.current.searchPerformed).toBe(true);
    expect(result.current.searchResults).toHaveLength(1);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe('');
    expect(result.current.searchResults).toEqual([]);
    expect(result.current.searchPerformed).toBe(false);
    // Discovery items reappear
    expect(result.current.showDiscovery).toBe(true);
    expect(result.current.items).toEqual([sampleDiscoveryItem]);
  });

  it('handleRefresh re-runs the last text search when one was performed', async () => {
    const search = searchAnswering(page([held('r1', 'Pasta')]));
    const { result } = renderRecipeScreen([search.mock]);

    await act(async () => {
      await result.current.handleTextSearch('pasta');
    });
    expect(search.fired).toHaveLength(1);

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(search.fired).toHaveLength(2);
    expect(search.fired[1]).toMatchObject({ query: 'pasta' });
    expect(mockDiscoveryRefresh).not.toHaveBeenCalled();
  });

  it('handleRefresh delegates to discovery.refresh when no search performed', async () => {
    const search = searchAnswering(page([]));
    const { result } = renderRecipeScreen([search.mock]);

    await act(async () => {
      await result.current.handleRefresh();
    });

    expect(mockDiscoveryRefresh).toHaveBeenCalledTimes(1);
    expect(search.fired).toEqual([]);
  });

  it('emptyStateConfig reflects loading and post-search empty states', async () => {
    const search = recordMock(SearchRecipesDocument, {
      data: page([]),
      held: true,
    });
    const { result } = renderRecipeScreen([search.mock]);

    expect(result.current.emptyStateConfig.title).toBe('Discover Recipes');

    let done!: Promise<void>;
    act(() => {
      done = result.current.handleTextSearch('zzznorelevantquery');
    });
    expect(result.current.searchLoading).toBe(true);
    expect(result.current.emptyStateConfig.icon).toBe('search');

    await act(async () => {
      search.release();
      await done;
    });

    expect(result.current.searchPerformed).toBe(true);
    expect(result.current.searchLoading).toBe(false);
    expect(result.current.emptyStateConfig.title).toBe('No recipes found');
  });

  describe('text-search pagination (load more)', () => {
    it('loadMoreSearch fetches the next page with the end cursor and appends', async () => {
      const search = recordMock(SearchRecipesDocument, {
        dataFor: vars =>
          vars.after === 'cursor-1'
            ? page([held('r2', 'Second')])
            : page([held('r1', 'First')], {
                endCursor: 'cursor-1',
                hasNextPage: true,
              }),
      });
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        await result.current.handleTextSearch('lasagna');
      });
      expect(result.current.searchHasMore).toBe(true);

      await act(async () => {
        await result.current.loadMoreSearch();
      });

      expect(search.fired[1]).toMatchObject({
        query: 'lasagna',
        after: 'cursor-1',
      });
      expect(ids(result.current.searchResults)).toEqual([
        'recipe-r1',
        'recipe-r2',
      ]);
      expect(result.current.searchHasMore).toBe(false);
      expect(result.current.searchLoadingMore).toBe(false);
    });

    it('searchHasMore follows pageInfo.hasNextPage', async () => {
      const { result } = renderRecipeScreen([
        searchAnswering(page([held('r1', 'Only')])).mock,
      ]);

      await act(async () => {
        await result.current.handleTextSearch('only');
      });

      expect(result.current.searchHasMore).toBe(false);
    });
  });

  describe('filter actions', () => {
    const veganProfile = {
      profile: {
        restrictions: [{ id: 'r1', diet: Diet.Vegan }],
        maxCookTimeMinutes: 30,
      },
      loading: false,
    };

    it('sends the active filters as the API filters', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const search = searchAnswering(page([]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });

      expect(search.fired[0]?.filters).toEqual({
        diets: [Diet.Vegan],
        maxReadyTime: 30,
      });
    });

    it('removeFilter narrows filters and re-runs the active search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const search = searchAnswering(page([held('r1', 'Pasta')]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });

      await act(async () => {
        result.current.removeFilter('diet', Diet.Vegan);
      });

      await waitFor(() => expect(search.fired).toHaveLength(2));
      expect(search.fired[1]?.filters).toEqual({ maxReadyTime: 30 });
      expect(result.current.activeFilters.diet).toEqual([]);
      expect(result.current.activeFilterCount).toBe(1);
    });

    it('clearFiltersAndSearchAgain clears all filters and re-runs the search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const search = searchAnswering(page([held('r1', 'Pasta')]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });

      await act(async () => {
        result.current.clearFiltersAndSearchAgain();
      });

      await waitFor(() => expect(search.fired).toHaveLength(2));
      expect(search.fired[1]?.filters).toEqual({});
      expect(result.current.activeFilterCount).toBe(0);
    });

    it('applyFilters commits the sheet draft and re-runs the active search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const search = searchAnswering(page([held('r1', 'Pasta')]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        await result.current.handleTextSearch('pasta');
      });

      await act(async () => {
        result.current.applyFilters({
          diet: [],
          intolerances: [],
          mealType: null,
          maxReadyTime: 15,
        });
      });

      await waitFor(() => expect(search.fired).toHaveLength(2));
      expect(search.fired[1]?.filters).toEqual({ maxReadyTime: 15 });
      expect(result.current.activeFilterCount).toBe(1);
    });

    it('sends the meal type as the category', async () => {
      const search = searchAnswering(page([]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        result.current.applyFilters({
          diet: [],
          intolerances: [],
          mealType: RecipeCategory.Breakfast,
          maxReadyTime: null,
        });
      });
      await act(async () => {
        await result.current.handleTextSearch('pancakes');
      });

      expect(search.fired[0]).toMatchObject({
        query: 'pancakes',
        filters: { category: RecipeCategory.Breakfast },
      });
    });

    it('does not re-run a search when filters change before any search', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const search = searchAnswering(page([]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        result.current.removeFilter('maxReadyTime');
      });

      expect(search.fired).toEqual([]);
      expect(result.current.activeFilters.maxReadyTime).toBeNull();
    });

    it('ingredient-search empty state does not blame filters (they never apply)', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const { result } = renderRecipeScreen([ingredientsAnswering([]).mock]);

      act(() => {
        result.current.toggleIngredient('Durian');
      });
      await act(async () => {
        await result.current.handleIngredientSearch();
      });

      // Filters are active but don't apply to ingredient search — the empty
      // state must use the plain copy with no clear-filters action.
      expect(result.current.searchLoading).toBe(false);
      expect(result.current.activeFilterCount).toBe(2);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.emptyStateConfig.action).toBeUndefined();
      expect(result.current.emptyStateConfig.description).not.toContain(
        'filter',
      );
    });

    it('empty state explains active filters and offers clear-and-retry', async () => {
      mockUseDietaryProfile.mockReturnValue(veganProfile);
      const search = searchAnswering(page([]));
      const { result } = renderRecipeScreen([search.mock]);

      await act(async () => {
        await result.current.handleTextSearch('zzznothing');
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

      await waitFor(() => expect(search.fired).toHaveLength(2));
      expect(search.fired[1]?.filters).toEqual({});
      expect(result.current.activeFilterCount).toBe(0);
    });
  });

  describe('superseded searches (staleness guard)', () => {
    it('discards a slow search superseded by a newer one', async () => {
      const slow = recordMock(SearchRecipesDocument, {
        data: page([held('apple', 'Apple Pie')]),
        match: vars => vars.query === 'app',
        held: true,
      });
      const fast = searchByQuery({
        banana: page([held('banana', 'Banana Bread')]),
      });
      const { result } = renderRecipeScreen([slow.mock, fast.mock]);

      let appDone!: Promise<void>;
      act(() => {
        appDone = result.current.handleTextSearch('app');
      });
      await act(async () => {
        await result.current.handleTextSearch('banana');
      });

      expect(result.current.searchQuery).toBe('banana');
      expect(ids(result.current.searchResults)).toEqual(['recipe-banana']);

      // The stale search resolves last — it must not overwrite the newer
      // results or the loading flag.
      await act(async () => {
        slow.release();
        await appDone;
      });

      expect(result.current.searchQuery).toBe('banana');
      expect(ids(result.current.searchResults)).toEqual(['recipe-banana']);
      expect(result.current.searchLoading).toBe(false);
    });

    it('a search cleared mid-flight does not repopulate the list on resolve', async () => {
      const pending = recordMock(SearchRecipesDocument, {
        data: page([held('soup', 'Tomato Soup')]),
        held: true,
      });
      const { result } = renderRecipeScreen([pending.mock]);

      let searchDone!: Promise<void>;
      act(() => {
        searchDone = result.current.handleTextSearch('soup');
      });
      expect(result.current.searchLoading).toBe(true);

      act(() => {
        result.current.clearSearch();
      });
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchPerformed).toBe(false);
      // Clearing mid-flight must drop the loading flag — otherwise the empty
      // state stays stuck on the "searching…" spinner.
      expect(result.current.searchLoading).toBe(false);

      await act(async () => {
        pending.release();
        await searchDone;
      });

      expect(result.current.searchResults).toEqual([]);
      expect(result.current.searchPerformed).toBe(false);
      expect(result.current.searchLoading).toBe(false);
    });

    it('discards an in-flight text search superseded by an ingredient search', async () => {
      const text = recordMock(SearchRecipesDocument, {
        data: page([held('pasta', 'Pasta')]),
        held: true,
      });
      const byIngredients = ingredientsAnswering([
        { used: 1, missed: 0, providerRecipeId: '8001', name: 'Tomato Soup' },
      ]);
      const { result } = renderRecipeScreen([text.mock, byIngredients.mock]);
      act(() => {
        result.current.toggleIngredient('Tomato');
      });

      let textDone!: Promise<void>;
      act(() => {
        textDone = result.current.handleTextSearch('pasta');
      });
      expect(result.current.searchLoading).toBe(true);

      await act(async () => {
        await result.current.handleIngredientSearch();
      });
      expect(ids(result.current.searchResults)).toEqual([
        'catalog-SPOONACULAR-8001',
      ]);

      await act(async () => {
        text.release();
        await textDone;
      });
      expect(ids(result.current.searchResults)).toEqual([
        'catalog-SPOONACULAR-8001',
      ]);
      expect(result.current.searchLoading).toBe(false);
    });

    it('discards an in-flight ingredient search superseded by a text search', async () => {
      const byIngredients = ingredientsAnswering(
        [{ used: 1, missed: 0, providerRecipeId: '8001', name: 'Tomato Soup' }],
        true,
      );
      const text = searchAnswering(page([held('pizza', 'Margherita Pizza')]));
      const { result } = renderRecipeScreen([byIngredients.mock, text.mock]);
      act(() => {
        result.current.toggleIngredient('Tomato');
      });

      let ingredientDone!: Promise<void>;
      act(() => {
        ingredientDone = result.current.handleIngredientSearch();
      });
      expect(result.current.searchLoading).toBe(true);

      await act(async () => {
        await result.current.handleTextSearch('pizza');
      });
      expect(ids(result.current.searchResults)).toEqual(['recipe-pizza']);

      await act(async () => {
        byIngredients.release();
        await ingredientDone;
      });
      expect(ids(result.current.searchResults)).toEqual(['recipe-pizza']);
      expect(result.current.searchLoading).toBe(false);
    });
  });
});
