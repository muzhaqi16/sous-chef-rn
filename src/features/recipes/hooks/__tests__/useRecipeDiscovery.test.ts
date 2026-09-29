import { act, waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeDiscovery } from '../useRecipeDiscovery';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import {
  useRecipeCacheStore,
  ingredientCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';
import type {
  RecipeInformation,
  RecipeSearchResult,
  SearchRecipesResult,
} from '#/services/spoonacular/types';

jest.mock('#/services/spoonacular/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipesByIngredients: jest.fn(),
    getRandomRecipes: jest.fn(),
    getBulkRecipeInformation: jest.fn(),
  },
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockUseCurrentHome = jest.fn();
jest.mock('#features/pantry/hooks/useCurrentHome', () => ({
  useCurrentHome: () => mockUseCurrentHome(),
}));

const mockUsePantryManagement = jest.fn();
jest.mock('#features/pantry/hooks/usePantryManagement', () => ({
  usePantryManagement: (...args: unknown[]) => mockUsePantryManagement(...args),
}));

// The hook gates its pantry watch on screen focus through `useFocusEffect`.
// Capture the callback so tests can drive focus/blur; it is never invoked
// automatically, so a rendered hook starts in its initial (focused) state.
type FocusCallback = () => (() => void) | void;
let focusCallback: FocusCallback | undefined;
let blurCleanup: (() => void) | void;
const mockUseFocusEffect = jest.fn((cb: FocusCallback) => {
  focusCallback = cb;
});
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb: FocusCallback) => mockUseFocusEffect(cb),
}));
const focus = () => {
  act(() => {
    blurCleanup = focusCallback?.();
  });
};
const blur = () => {
  act(() => {
    if (typeof blurCleanup === 'function') blurCleanup();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  useRecipeCacheStore.getState().clearAllCache();

  // Default: signed in, home selected, no pantry items, not loading
  mockUseCurrentHome.mockReturnValue({
    currentHome: {
      id: 'home-1',
      pantriesConnection: {
        edges: [{ node: { id: 'pantry-1', isDefault: true } }],
      },
    },
  });
  mockUsePantryManagement.mockReturnValue({
    state: {
      items: [],
      loading: false,
      hasMore: false,
      isLoadingMore: false,
    },
    actions: { loadMore: jest.fn() },
  });
});

afterEach(() => {
  useRecipeCacheStore.getState().clearAllCache();
});

describe('useRecipeDiscovery', () => {
  it('returns initial loading state', () => {
    // Even with empty pantry, hook starts loading until fetch resolves
    (spoonacularService.getRandomRecipes as jest.Mock).mockReturnValue(
      new Promise(() => {}), // Never resolves
    );

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    expect(result.current.loading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.mode).toBe('none');
  });

  it('fetches random recipes when pantry is empty', async () => {
    const randomRecipes = [
      {
        id: 100,
        title: 'Random Recipe 1',
        servings: 2,
        readyInMinutes: 20,
        image: 'https://example.com/r1.jpg',
      },
      {
        id: 101,
        title: 'Random Recipe 2',
        servings: 4,
        readyInMinutes: 35,
        image: 'https://example.com/r2.jpg',
      },
    ];
    (spoonacularService.getRandomRecipes as jest.Mock).mockResolvedValue(
      randomRecipes,
    );

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mode).toBe('random');
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toEqual(
      expect.objectContaining({
        title: 'Random Recipe 1',
        spoonacularId: 100,
        badge: { text: 'Suggested' },
      }),
    );
  });

  it('fetches pantry-based recipes when pantry has items', async () => {
    mockUsePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: 'p1', itemName: 'tomato' },
          { id: 'p2', itemName: 'pasta' },
        ],
        loading: false,
        hasMore: false,
        isLoadingMore: false,
      },
      actions: { loadMore: jest.fn() },
    });

    const pantryRecipes = [
      {
        id: 200,
        title: 'Tomato Pasta',
        usedIngredientCount: 2,
        missedIngredientCount: 1,
        likes: 50,
        image: 'https://example.com/tp.jpg',
      },
    ];
    (
      spoonacularService.searchRecipesByIngredients as jest.Mock
    ).mockResolvedValue(pantryRecipes);
    (
      spoonacularService.getBulkRecipeInformation as jest.Mock
    ).mockResolvedValue([]);

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.mode).toBe('pantry');
    expect(result.current.hasPantryItems).toBe(true);
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toEqual(
      expect.objectContaining({
        title: 'Tomato Pasta',
        spoonacularId: 200,
        badge: {
          text: '2 of 3 ingredients in your pantry, 1 to buy',
          lines: [
            { icon: 'checkmark-circle', text: '2', variant: 'success' },
            { icon: 'cart-outline', text: '1', variant: 'warning' },
          ],
        },
      }),
    );
    expect(spoonacularService.searchRecipesByIngredients).toHaveBeenCalledWith(
      expect.objectContaining({ ingredients: 'tomato,pasta' }),
    );
  });

  it('returns cached random results without calling the API', async () => {
    // Pre-populate cache for "random:none" key
    useRecipeCacheStore.getState().setCached('random:none', [
      {
        id: 999,
        title: 'Cached Random',
        servings: 2,
        readyInMinutes: 15,
        image: 'https://example.com/cr.jpg',
        imageType: 'jpg',
      } satisfies SearchRecipesResult,
    ]);

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(spoonacularService.getRandomRecipes).not.toHaveBeenCalled();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]?.title).toBe('Cached Random');
  });

  it('exposes pantry pagination flags', () => {
    const loadMore = jest.fn();
    mockUsePantryManagement.mockReturnValue({
      state: {
        items: [{ id: 'p1', itemName: 'apple' }],
        loading: false,
        hasMore: true,
        isLoadingMore: false,
      },
      actions: { loadMore },
    });
    (
      spoonacularService.searchRecipesByIngredients as jest.Mock
    ).mockResolvedValue([]);

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    expect(result.current.pantryHasMore).toBe(true);
    expect(result.current.pantryLoadingMore).toBe(false);
    expect(result.current.hasPantryItems).toBe(true);

    result.current.loadMorePantryItems();
    expect(loadMore).toHaveBeenCalled();
  });

  it('handles API errors gracefully', async () => {
    (spoonacularService.getRandomRecipes as jest.Mock).mockRejectedValue(
      new Error('Spoonacular down'),
    );
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([]);
    expect(result.current.mode).toBe('none');
    consoleSpy.mockRestore();
  });

  it('paginates results client-side via loadMoreDiscovery', async () => {
    // 20 random results — DISCOVERY_PAGE_SIZE = 15
    const randomRecipes = Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      title: `Recipe ${i + 1}`,
      servings: 2,
      readyInMinutes: 20,
      image: `https://example.com/${i}.jpg`,
    }));
    (spoonacularService.getRandomRecipes as jest.Mock).mockResolvedValue(
      randomRecipes,
    );

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toHaveLength(15);
    expect(result.current.discoveryHasMore).toBe(true);

    result.current.loadMoreDiscovery();

    await waitFor(() =>
      expect(result.current.items.length).toBeGreaterThan(15),
    );
    expect(result.current.items).toHaveLength(20);
    expect(result.current.discoveryHasMore).toBe(false);
  });
});

describe('useRecipeDiscovery: focus gate on the pantry watch', () => {
  const pantryWatchArgs = (skip: boolean) => [
    'pantry-1',
    { skip, fetchPolicy: 'cache-first' },
  ];

  it('watches the pantry while focused and stands the watch down while blurred', () => {
    (spoonacularService.getRandomRecipes as jest.Mock).mockReturnValue(
      new Promise(() => {}),
    );
    renderHookWithApollo(() => useRecipeDiscovery());
    expect(mockUsePantryManagement).toHaveBeenLastCalledWith(
      ...pantryWatchArgs(false),
    );

    focus();
    blur();
    expect(mockUsePantryManagement).toHaveBeenLastCalledWith(
      ...pantryWatchArgs(true),
    );

    focus();
    expect(mockUsePantryManagement).toHaveBeenLastCalledWith(
      ...pantryWatchArgs(false),
    );
  });

  it('does not re-run discovery across a blur/focus cycle when the pantry is unchanged', async () => {
    // The Recipes tab stays mounted while hidden. Before the gate, every pantry
    // write on another tab re-rendered it and — the discovery cache being keyed
    // by the ingredient list — called the recipe API again. Focus changes alone
    // must not cost a request either.
    mockUsePantryManagement.mockReturnValue({
      state: {
        items: [
          { id: 'p1', itemName: 'tomato' },
          { id: 'p2', itemName: 'pasta' },
        ],
        loading: false,
        hasMore: false,
        isLoadingMore: false,
      },
      actions: { loadMore: jest.fn() },
    });
    (
      spoonacularService.searchRecipesByIngredients as jest.Mock
    ).mockResolvedValue([
      {
        id: 200,
        title: 'Tomato Pasta',
        usedIngredientCount: 2,
        missedIngredientCount: 1,
        likes: 50,
        image: 'https://example.com/tp.jpg',
      },
    ]);
    (
      spoonacularService.getBulkRecipeInformation as jest.Mock
    ).mockResolvedValue([]);

    const { result } = renderHookWithApollo(() => useRecipeDiscovery());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(spoonacularService.searchRecipesByIngredients).toHaveBeenCalledTimes(
      1,
    );

    focus();
    blur();
    focus();
    await act(async () => {
      await Promise.resolve();
    });

    expect(spoonacularService.searchRecipesByIngredients).toHaveBeenCalledTimes(
      1,
    );
    expect(result.current.mode).toBe('pantry');
  });
});

describe('useRecipeDiscovery: refresh', () => {
  const searchResult = (
    id: number,
    title: string,
    used: number,
    missed: number,
  ): RecipeSearchResult => ({
    id,
    title,
    image: `https://example.com/${id}.jpg`,
    imageType: 'jpg',
    usedIngredientCount: used,
    missedIngredientCount: missed,
    missedIngredients: [],
    usedIngredients: [],
    unusedIngredients: [],
    likes: 7,
  });
  const tomatoPasta = searchResult(200, 'Tomato Pasta', 2, 1);
  const tomatoSoup = searchResult(201, 'Tomato Soup', 1, 2);
  // Enrichment reads only these fields; the rest of the payload is irrelevant.
  const info = (id: number, servings: number): RecipeInformation => {
    const read: Partial<RecipeInformation> = {
      id,
      title: `Recipe ${id}`,
      servings,
      readyInMinutes: 30,
    };
    return read as RecipeInformation;
  };

  function deferred<T>() {
    let resolve: (value: T) => void = () => {};
    let reject: (error: unknown) => void = () => {};
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  // A warm cache renders enriched rows at once, the state a pull starts from.
  async function renderWithEnrichedRows() {
    mockUsePantryManagement.mockReturnValue({
      state: {
        items: [{ id: 'p1', itemName: 'tomato' }],
        loading: false,
        hasMore: false,
        isLoadingMore: false,
      },
      actions: { loadMore: jest.fn() },
    });
    useRecipeCacheStore
      .getState()
      .setCached(ingredientCacheKey('tomato'), [tomatoPasta], {
        200: info(200, 4),
      });

    const rendered = renderHookWithApollo(() => useRecipeDiscovery());
    await waitFor(() => expect(rendered.result.current.loading).toBe(false));
    expect(rendered.result.current.items[0]?.subtitle).toContain('4 servings');
    return rendered;
  }

  it('keeps the rows on screen until their replacements are enriched', async () => {
    const { result } = await renderWithEnrichedRows();
    const before = result.current.items;

    const search = deferred<RecipeSearchResult[]>();
    const bulk = deferred<RecipeInformation[]>();
    (
      spoonacularService.searchRecipesByIngredients as jest.Mock
    ).mockReturnValue(search.promise);
    (spoonacularService.getBulkRecipeInformation as jest.Mock).mockReturnValue(
      bulk.promise,
    );

    let refreshed: Promise<void> = Promise.resolve();
    act(() => {
      refreshed = result.current.refresh();
    });
    expect(result.current.items).toBe(before);

    await act(async () => {
      search.resolve([tomatoPasta, tomatoSoup]);
      await Promise.resolve();
    });
    expect(result.current.items).toBe(before);

    await act(async () => {
      bulk.resolve([info(201, 2)]);
      await refreshed;
    });

    expect(result.current.items.map(item => item.subtitle)).toEqual([
      expect.stringContaining('4 servings'),
      expect.stringContaining('2 servings'),
    ]);
    // A returning recipe's enrichment is reused rather than fetched again.
    expect(spoonacularService.getBulkRecipeInformation).toHaveBeenCalledWith(
      [201],
      undefined,
    );
    expect(result.current.loading).toBe(false);
  });

  it('keeps the rows and the cached entry when the refresh fails', async () => {
    const { result } = await renderWithEnrichedRows();
    const before = result.current.items;
    (
      spoonacularService.searchRecipesByIngredients as jest.Mock
    ).mockRejectedValue(new Error('Spoonacular down'));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.items).toBe(before);
    expect(result.current.loading).toBe(false);
    expect(
      useRecipeCacheStore.getState().getCached(ingredientCacheKey('tomato'))
        ?.results,
    ).toEqual([tomatoPasta]);
  });
});
