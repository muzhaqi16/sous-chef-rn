import { waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeDiscovery } from '../useRecipeDiscovery';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import { useRecipeCacheStore } from '#/store/useRecipeCacheStore';

jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    searchRecipesByIngredients: jest.fn(),
    getRandomRecipes: jest.fn(),
    getBulkRecipeInformation: jest.fn(),
  },
}));

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockUseDefaultHome = jest.fn();
jest.mock('#hooks/home/useDefaultHome', () => ({
  useDefaultHome: () => mockUseDefaultHome(),
}));

const mockUsePantryManagement = jest.fn();
jest.mock('#hooks/home/pantry/usePantryManagement', () => ({
  usePantryManagement: (id?: string) => mockUsePantryManagement(id),
}));

beforeEach(() => {
  jest.clearAllMocks();
  useRecipeCacheStore.getState().clearAllCache();

  // Default: signed in, home selected, no pantry items, not loading
  mockUseDefaultHome.mockReturnValue({
    state: { selectedHomeId: 'home-1' },
    actions: { getDefaultPantry: () => ({ id: 'pantry-1' }) },
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
        badge: expect.objectContaining({ text: '2/3 match' }),
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
      } as any,
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
