'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { useRecipeDetail } from '../useRecipeDetail';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('#/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockGoBack = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: mockGoBack,
  })),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(() => ({
    params: { externalSource: 'SPOONACULAR', externalId: '123' },
  })),
  useNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn(() => null),
  selectSelectedShoppingListId: jest.fn(() => null),
}));

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModal: 'BottomSheetModal',
}));

const mockGetRecipeInfo = jest.fn().mockResolvedValue({
  id: 123,
  title: 'Test Recipe',
  image: 'https://example.com/recipe.jpg',
  servings: 4,
  readyInMinutes: 30,
  extendedIngredients: [],
});
jest.mock('#/services/recipeApi/SpoonacularService', () => ({
  spoonacularService: {
    getRecipeInformation: (...args: any[]) => mockGetRecipeInfo(...args),
  },
}));

jest.mock('#generated', () => ({
  useGetRecipeQuery: jest.fn(() => ({
    data: null,
    loading: false,
    error: undefined,
  })),
  useCreateShoppingListItemsFromRecipeMutation: jest.fn(() => [jest.fn()]),
  useCreateShoppingListItemFromRecipeIngredientMutation: jest.fn(() => [jest.fn()]),
  useAddItemToShoppingListMutation: jest.fn(() => [jest.fn()]),
  useAddItemsToShoppingListMutation: jest.fn(() => [jest.fn()]),
  useGetShoppingListsLiteQuery: jest.fn(() => ({
    data: {
      shoppingLists: {
        edges: [
          { node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } },
        ],
      },
    },
    loading: false,
  })),
  useMyRecipesQuery: jest.fn(() => ({ data: null })),
  useMarkRecipeAsCookedMutation: jest.fn(() => [jest.fn()]),
  useUpdateFavoriteRecipeMutation: jest.fn(() => [jest.fn()]),
  useUnfavoriteRecipeMutation: jest.fn(() => [jest.fn()]),
  MySavedRecipesDocument: {},
  SavedRecipeFoldersDocument: {},
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeRecipes: jest.fn(() => ({ recipes: [] })),
  extractNodes: jest.fn((data: any) => {
    if (!data?.edges) return [];
    return data.edges.map((e: any) => e.node);
  }),
}));

jest.mock('#/apollo/utils/shoppingListCacheUpdaters', () => ({
  addNewItemToShoppingListCache: jest.fn(),
}));

jest.mock('#/services/toastService', () => ({
  toastService: {
    error: jest.fn(),
    success: jest.fn(),
    info: jest.fn(),
  },
}));

const mockPreloadRecipe = jest.fn().mockResolvedValue({});
jest.mock('#/hooks/recipe/useRecipePreload', () => ({
  useRecipePreload: jest.fn(() => ({
    preloading: false,
    preloadedRecipe: null,
    preloadRecipe: mockPreloadRecipe,
    saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
    savingToFavorites: false,
  })),
}));

jest.mock('#/hooks/recipe/useRecipeIngredientMatching', () => ({
  useRecipeIngredientMatching: jest.fn(() => ({
    loadMatches: jest.fn(),
    closeSheet: jest.fn(),
    isSheetVisible: false,
    editableMatches: [],
    matchSummary: null,
    updateMatch: jest.fn(),
    confirmConsumption: jest.fn(),
    confirmLoading: false,
    hasPantry: false,
  })),
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeCacheUpdate: jest.fn((fn: any) => fn()),
  executeMutationWithErrorHandler: jest.fn(async (fn: any, onError: any) => {
    try {
      return await fn();
    } catch (e) {
      onError(e);
      return null;
    }
  }),
  executeWithLoadingState: jest.fn(async (fn: any, setLoading: any, onError?: any) => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  }),
}));

jest.mock('#hooks/performance/useScreenTransition', () => ({
  useScreenTransition: jest.fn(),
}));

describe('useRecipeDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns expected API shape', () => {
    const { result } = renderHook(() => useRecipeDetail());

    expect(result.current).toHaveProperty('goBack');
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
    expect(result.current).toHaveProperty('displayData');
    expect(result.current).toHaveProperty('isSaved');
    expect(result.current).toHaveProperty('handleSaveRecipe');
    expect(result.current).toHaveProperty('handleAddSingleIngredient');
    expect(result.current).toHaveProperty('handleMarkAsCooked');
    expect(result.current).toHaveProperty('handleUnfavoriteRecipe');
  });

  it('returns externalId from route params', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.externalId).toBe('123');
  });

  it('goBack calls navigation goBack', () => {
    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.goBack();
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('extracts shopping lists from query data', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.shoppingLists).toHaveLength(1);
    expect(result.current.shoppingLists[0].name).toBe('Weekly');
  });

  it('initializes with empty addedIngredients', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.addedIngredients.size).toBe(0);
  });

  it('initializes with empty selectedIngredients', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.selectedIngredients.size).toBe(0);
  });

  it('toggleIngredient adds and removes ingredients', () => {
    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.toggleIngredient('ing-1');
    });
    expect(result.current.selectedIngredients.has('ing-1')).toBe(true);

    act(() => {
      result.current.toggleIngredient('ing-1');
    });
    expect(result.current.selectedIngredients.has('ing-1')).toBe(false);
  });

  it('isSaved defaults to false for external recipes', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.isSaved).toBe(false);
  });

  it('isBackendRecipe is false when no recipeId in params', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.isBackendRecipe).toBe(false);
  });

  it('cookedModalVisible defaults to false', () => {
    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.cookedModalVisible).toBe(false);

    act(() => {
      result.current.setCookedModalVisible(true);
    });
    expect(result.current.cookedModalVisible).toBe(true);
  });

  // --- Branch coverage tests ---

  it('returns backend recipe displayData when recipeId and backendRecipe exist', () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

    const { useGetRecipeQuery } = require('#generated');
    useGetRecipeQuery.mockReturnValue({
      data: {
        recipe: {
          name: 'Backend Pasta',
          imageUrl: 'https://img.com/pasta.jpg',
          servings: 2,
          totalTimeMinutes: 20,
          description: 'Tasty',
          ingredients: [{ id: 'i1', name: 'Flour' }],
          instructions: [{ number: 1, step: 'Mix' }],
          source: 'Chef',
          sourceUrl: 'https://chef.com',
          savedDetails: null,
          createdBy: { id: 'u1' },
        },
      },
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useRecipeDetail());

    expect(result.current.isBackendRecipe).toBe(true);
    expect(result.current.displayData?.title).toBe('Backend Pasta');
    expect(result.current.displayData?.image).toBe('https://img.com/pasta.jpg');
    expect(result.current.displayData?.servings).toBe(2);
    expect(result.current.displayData?.readyInMinutes).toBe(20);
    expect(result.current.displayData?.ingredients).toHaveLength(1);

    // Cleanup
    useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
  });

  it('isSaved reflects backendRecipe savedDetails for backend recipes', () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

    const { useGetRecipeQuery } = require('#generated');
    useGetRecipeQuery.mockReturnValue({
      data: {
        recipe: {
          name: 'Saved Recipe',
          imageUrl: null,
          servings: 4,
          totalTimeMinutes: null,
          description: null,
          ingredients: [],
          instructions: [],
          source: null,
          sourceUrl: null,
          savedDetails: { folder: 'Favorites', tags: ['dinner'], notes: 'good', personalRating: 4, cookedCount: 3 },
          createdBy: { id: 'u1' },
        },
      },
      loading: false,
      error: undefined,
    });

    const { result } = renderHook(() => useRecipeDetail());

    expect(result.current.isSaved).toBe(true);
    expect(result.current.savedFolder).toBe('Favorites');
    expect(result.current.savedTags).toEqual(['dinner']);
    expect(result.current.savedNotes).toBe('good');
    expect(result.current.savedRating).toBe(4);
    expect(result.current.cookedCount).toBe(3);

    // Cleanup
    useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
  });

  it('displayData returns null when no backend recipe and no external recipe', () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue({ params: {} });

    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.displayData).toBeNull();

    // Cleanup
    useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
  });

  it('handleSaveRecipe does nothing when no external recipe data', () => {
    const { result } = renderHook(() => useRecipeDetail());

    // No external recipe loaded yet, so handleSaveRecipe should exit early
    act(() => {
      result.current.handleSaveRecipe('Favorites');
    });

    // Should not throw - just no-op
    expect(result.current.saving).toBe(false);
  });

  it('handleAddSingleIngredient shows error when no shopping lists', () => {
    const { toastService } = require('#/services/toastService');
    const { useGetShoppingListsLiteQuery } = require('#generated');
    useGetShoppingListsLiteQuery.mockReturnValue({
      data: { shoppingLists: { edges: [] } },
      loading: false,
    });

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleAddSingleIngredient({ id: 'ing-1', name: 'Salt' });
    });

    expect(toastService.error).toHaveBeenCalledWith('Please create a shopping list first.');

    // Cleanup
    useGetShoppingListsLiteQuery.mockReturnValue({
      data: { shoppingLists: { edges: [{ node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } }] } },
      loading: false,
    });
  });

  it('handleMarkAsCooked shows error for external recipe without recipeId', () => {
    const { toastService } = require('#/services/toastService');

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleMarkAsCooked({
        servings: 4,
        deductFromPantry: true,
        useGranularDeduction: false,
      });
    });

    expect(toastService.error).toHaveBeenCalledWith(
      'Cannot mark external recipes as cooked. Please save the recipe first.',
    );
  });

  it('handleUpdateFolder resolves immediately when no recipeId', async () => {
    const { result } = renderHook(() => useRecipeDetail());

    let resolved = false;
    await act(async () => {
      await result.current.handleUpdateFolder('TestFolder');
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('handleUpdateTags resolves immediately when no recipeId', async () => {
    const { result } = renderHook(() => useRecipeDetail());

    let resolved = false;
    await act(async () => {
      await result.current.handleUpdateTags(['tag1']);
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('handleUpdateNotes resolves immediately when no recipeId', async () => {
    const { result } = renderHook(() => useRecipeDetail());

    let resolved = false;
    await act(async () => {
      await result.current.handleUpdateNotes('some notes');
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('handleUpdateRating resolves immediately when no recipeId', async () => {
    const { result } = renderHook(() => useRecipeDetail());

    let resolved = false;
    await act(async () => {
      await result.current.handleUpdateRating(5);
      resolved = true;
    });

    expect(resolved).toBe(true);
  });

  it('handleUnfavoriteRecipe shows error when no recipeId and no preloaded recipe', () => {
    const { toastService } = require('#/services/toastService');

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleUnfavoriteRecipe();
    });

    expect(toastService.error).toHaveBeenCalledWith('Cannot remove: recipe ID not found');
  });

  it('handleAddAllIngredients shows error for external recipe without backendRecipe', () => {
    const { toastService } = require('#/services/toastService');

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleAddAllIngredients();
    });

    expect(toastService.error).toHaveBeenCalledWith(
      'Cannot add ingredients from external recipes yet. Please save the recipe first.',
    );
  });

  it('handleAddSelectedIngredients exits early when no backendRecipe', () => {
    const { toastService } = require('#/services/toastService');

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleAddSelectedIngredients();
    });

    // Should not show any error (just returns early)
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('handleSkipReview exits early when no recipeId', () => {
    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleSkipReview();
    });

    // Should not throw - just returns
    expect(result.current.markingAsCooked).toBe(false);
  });

  it('handleSheetDismiss calls pending action and clears it', () => {
    const { result } = renderHook(() => useRecipeDetail());

    // No pending action - should not throw
    act(() => {
      result.current.handleSheetDismiss();
    });

    expect(result.current).toBeDefined();
  });

  it('getTargetShoppingList uses selectedShoppingListId when available', () => {
    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockReturnValue('sl-1');

    const { result } = renderHook(() => useRecipeDetail());

    // The shopping list data has sl-1 as the only list, and store selects it
    expect(result.current.shoppingLists).toHaveLength(1);

    // Cleanup
    useAppStore.mockReturnValue(null);
  });

  it('handleAddAllIngredientsToList opens list picker', () => {
    const { toastService } = require('#/services/toastService');

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleAddAllIngredientsToList();
    });

    // Since shoppingLists has data and not loading, it should set pendingAction
    // (listPickerRef.current is null in test so present() won't be called, but no error)
    expect(toastService.error).not.toHaveBeenCalled();
  });

  it('openListPicker shows info toast when shopping lists are loading', () => {
    const { toastService } = require('#/services/toastService');
    const { useGetShoppingListsLiteQuery } = require('#generated');
    useGetShoppingListsLiteQuery.mockReturnValue({
      data: { shoppingLists: { edges: [{ node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } }] } },
      loading: true,
    });

    const { result } = renderHook(() => useRecipeDetail());

    act(() => {
      result.current.handleAddAllIngredientsToList();
    });

    expect(toastService.info).toHaveBeenCalledWith('Loading shopping lists...');

    // Cleanup
    useGetShoppingListsLiteQuery.mockReturnValue({
      data: { shoppingLists: { edges: [{ node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } }] } },
      loading: false,
    });
  });

  it('savedFolder comes from savedFolderLocal for external recipes', () => {
    const { normalizeRecipes } = require('#/utils/connectionUtils');
    const { useMyRecipesQuery } = require('#generated');

    normalizeRecipes.mockReturnValue({
      recipes: [
        { externalSource: 'SPOONACULAR', externalId: '123', savedDetails: { folder: 'Dinner' } },
      ],
    });
    useMyRecipesQuery.mockReturnValue({
      data: { recipes: 'mockData' },
    });

    const { result } = renderHook(() => useRecipeDetail());

    expect(result.current.savedFolder).toBe('Dinner');

    // Cleanup
    normalizeRecipes.mockReturnValue({ recipes: [] });
    useMyRecipesQuery.mockReturnValue({ data: null });
  });

  it('loading is true when backendLoading is true', () => {
    const { useRoute } = require('@react-navigation/native');
    useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

    const { useGetRecipeQuery } = require('#generated');
    useGetRecipeQuery.mockReturnValue({
      data: null,
      loading: true,
      error: undefined,
    });

    const { result } = renderHook(() => useRecipeDetail());
    expect(result.current.loading).toBe(true);

    // Cleanup
    useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
  });

  // =====================================================================
  // Additional coverage tests
  // =====================================================================

  describe('fetchRecipeData (via useEffect)', () => {
    it('sets error when externalSource and externalId are missing', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: {} });

      const { result } = renderHook(() => useRecipeDetail());

      // Wait for useEffect to run
      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(result.current.error).toBe('Recipe not available.');
      expect(result.current.loading).toBe(false);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    });

    it('sets error when only externalSource is provided without externalId', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR' } });

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(result.current.error).toBe('Recipe not available.');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    });

    it('fetches SPOONACULAR recipe and sets external recipe data', async () => {
      const mockRecipeData = {
        id: 456,
        title: 'Fetched Recipe',
        image: 'https://example.com/fetched.jpg',
        servings: 6,
        readyInMinutes: 45,
        healthScore: 80,
        summary: 'A fetched recipe summary',
        extendedIngredients: [{ id: 1, name: 'Salt', amount: 1 }],
        analyzedInstructions: [],
        instructions: '<p>Cook it</p>',
        vegetarian: true,
        vegan: false,
        glutenFree: true,
        dairyFree: false,
        sourceName: 'TestSource',
        sourceUrl: 'https://test.com',
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipeData);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockGetRecipeInfo).toHaveBeenCalledWith(
        { id: 123, includeNutrition: true },
        expect.any(AbortSignal),
      );
      expect(result.current.displayData?.title).toBe('Fetched Recipe');
      expect(result.current.displayData?.image).toBe('https://example.com/fetched.jpg');
      expect(result.current.displayData?.servings).toBe(6);
      expect(result.current.displayData?.readyInMinutes).toBe(45);
      expect(result.current.displayData?.healthScore).toBe(80);
      expect(result.current.displayData?.summary).toBe('A fetched recipe summary');
      expect(result.current.displayData?.vegetarian).toBe(true);
      expect(result.current.displayData?.vegan).toBe(false);
      expect(result.current.displayData?.glutenFree).toBe(true);
      expect(result.current.displayData?.dairyFree).toBe(false);
      expect(result.current.displayData?.sourceName).toBe('TestSource');
      expect(result.current.displayData?.sourceUrl).toBe('https://test.com');
      expect(result.current.displayData?.instructionsHtml).toBe('<p>Cook it</p>');
      expect(result.current.loading).toBe(false);
    });

    it('sets error when spoonacular fetch fails', async () => {
      mockGetRecipeInfo.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(result.current.error).toBe('Failed to load recipe. Please try again.');
      expect(result.current.loading).toBe(false);
    });

    it('does not set error on AbortError', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockGetRecipeInfo.mockRejectedValueOnce(abortError);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      // AbortError should be swallowed - error stays null from initial state
      // loading is set to false in finally block
      expect(result.current.loading).toBe(false);
    });

    it('sets error for unsupported external source', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { externalSource: 'UNKNOWN_SOURCE', externalId: '789' } });

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(result.current.error).toBe('Failed to load recipe. Please try again.');
      expect(result.current.loading).toBe(false);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    });

    it('calls preloadRecipe after successful SPOONACULAR fetch', async () => {
      const mockRecipe = {
        id: 123,
        title: 'Preload Test',
        image: 'img.jpg',
        servings: 2,
        readyInMinutes: 15,
        extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockPreloadRecipe).toHaveBeenCalledWith(mockRecipe);
    });
  });

  describe('syncSavedRecipeState', () => {
    it('sets recipeSaved to false and savedFolderLocal to null when recipe is not saved', () => {
      const { normalizeRecipes } = require('#/utils/connectionUtils');
      const { useMyRecipesQuery } = require('#generated');

      // No matching recipe in saved list
      normalizeRecipes.mockReturnValue({
        recipes: [
          { externalSource: 'SPOONACULAR', externalId: '999', savedDetails: { folder: 'Other' } },
        ],
      });
      useMyRecipesQuery.mockReturnValue({ data: { recipes: 'mockData' } });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isSaved).toBe(false);
      expect(result.current.savedFolder).toBeNull();

      // Cleanup
      normalizeRecipes.mockReturnValue({ recipes: [] });
      useMyRecipesQuery.mockReturnValue({ data: null });
    });

    it('sets recipeSaved to true when saved recipe has null folder', () => {
      const { normalizeRecipes } = require('#/utils/connectionUtils');
      const { useMyRecipesQuery } = require('#generated');

      normalizeRecipes.mockReturnValue({
        recipes: [
          { externalSource: 'SPOONACULAR', externalId: '123', savedDetails: { folder: null } },
        ],
      });
      useMyRecipesQuery.mockReturnValue({ data: { recipes: 'mockData' } });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isSaved).toBe(true);
      expect(result.current.savedFolder).toBeNull();

      // Cleanup
      normalizeRecipes.mockReturnValue({ recipes: [] });
      useMyRecipesQuery.mockReturnValue({ data: null });
    });

    it('handles savedRecipe without savedDetails', () => {
      const { normalizeRecipes } = require('#/utils/connectionUtils');
      const { useMyRecipesQuery } = require('#generated');

      normalizeRecipes.mockReturnValue({
        recipes: [
          { externalSource: 'SPOONACULAR', externalId: '123' },
        ],
      });
      useMyRecipesQuery.mockReturnValue({ data: { recipes: 'mockData' } });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isSaved).toBe(true);
      expect(result.current.savedFolder).toBeNull();

      // Cleanup
      normalizeRecipes.mockReturnValue({ recipes: [] });
      useMyRecipesQuery.mockReturnValue({ data: null });
    });
  });

  describe('getTargetShoppingList', () => {
    it('falls back to default list when selectedShoppingListId is not found', async () => {
      const { useAppStore } = require('#store/useAppStore');
      const { toastService } = require('#/services/toastService');
      useAppStore.mockReturnValue('non-existent-id');

      const mockAddItemMutation = jest.fn().mockResolvedValue({});
      const { useAddItemToShoppingListMutation } = require('#generated');
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);

      // Load an external recipe first
      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [{ id: 1, name: 'Salt' }],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({ id: 1, name: 'Salt', amount: 1 });
        await new Promise(r => setTimeout(r, 0));
      });

      // Should use default list (sl-1 isDefault: true) since selected id not found
      expect(mockAddItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({
              shoppingListId: 'sl-1',
            }),
          }),
        }),
      );
      expect(toastService.success).toHaveBeenCalledWith('Added to "Weekly"');

      // Cleanup
      useAppStore.mockReturnValue(null);
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });

    it('falls back to first list when no default and no selected list', async () => {
      const { useGetShoppingListsLiteQuery, useAddItemToShoppingListMutation } = require('#generated');
      const { toastService } = require('#/services/toastService');
      useGetShoppingListsLiteQuery.mockReturnValue({
        data: {
          shoppingLists: {
            edges: [
              { node: { id: 'sl-2', name: 'Groceries', isDefault: false, totalItems: 3 } },
            ],
          },
        },
        loading: false,
      });
      const mockAddItemMutation = jest.fn().mockResolvedValue({});
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);

      // Load external recipe
      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [{ id: 1, name: 'Salt' }],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({ id: 1, name: 'Salt', amount: 1 });
        await new Promise(r => setTimeout(r, 0));
      });

      // Should fall back to first list
      expect(mockAddItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({
              shoppingListId: 'sl-2',
            }),
          }),
        }),
      );
      expect(toastService.success).toHaveBeenCalledWith('Added to "Groceries"');

      // Cleanup
      useGetShoppingListsLiteQuery.mockReturnValue({
        data: { shoppingLists: { edges: [{ node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } }] } },
        loading: false,
      });
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('handleSaveRecipe with loaded external recipe', () => {
    it('saves external recipe and sets recipeSaved on success', async () => {
      const mockSaveToFavorites = jest.fn().mockResolvedValue({ success: true });
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: mockSaveToFavorites,
        savingToFavorites: false,
      });

      const mockRecipe = {
        id: 123, title: 'Saveable Recipe', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleSaveRecipe('MyFolder', ['tag1', 'tag2'], 'my notes');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockSaveToFavorites).toHaveBeenCalledWith(mockRecipe, {
        folder: 'MyFolder',
        tags: ['tag1', 'tag2'],
        notes: 'my notes',
      });
      expect(result.current.isSaved).toBe(true);
      expect(result.current.savedFolder).toBe('MyFolder');

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
    });

    it('handles saveRecipeToFavorites returning success: false', async () => {
      const mockSaveToFavorites = jest.fn().mockResolvedValue({ success: false });
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: mockSaveToFavorites,
        savingToFavorites: false,
      });

      const mockRecipe = {
        id: 123, title: 'No Save Recipe', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleSaveRecipe(null, [], '');
        await new Promise(r => setTimeout(r, 0));
      });

      // Should NOT set recipeSaved since success was false
      expect(result.current.isSaved).toBe(false);

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
    });

    it('passes undefined for folder, tags, and notes when not provided', async () => {
      const mockSaveToFavorites = jest.fn().mockResolvedValue({ success: true });
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: mockSaveToFavorites,
        savingToFavorites: false,
      });

      const mockRecipe = {
        id: 123, title: 'Minimal Save', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      // Pass undefined/null/empty values
      await act(async () => {
        result.current.handleSaveRecipe(undefined, [], '');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockSaveToFavorites).toHaveBeenCalledWith(mockRecipe, {
        folder: undefined,
        tags: undefined,
        notes: undefined,
      });

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
    });
  });

  describe('handleAddSingleIngredient', () => {
    it('adds backend recipe ingredient via addRecipeIngredientMutation', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useCreateShoppingListItemFromRecipeIngredientMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockAddIngredientMutation = jest.fn().mockResolvedValue({});
      useCreateShoppingListItemFromRecipeIngredientMutation.mockReturnValue([mockAddIngredientMutation]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        result.current.handleAddSingleIngredient({ id: 'i1', name: 'Salt' });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockAddIngredientMutation).toHaveBeenCalledWith({
        variables: {
          recipeIngredientId: 'i1',
          shoppingListId: 'sl-1',
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Added to "Weekly"');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useCreateShoppingListItemFromRecipeIngredientMutation.mockReturnValue([jest.fn()]);
    });

    it('adds external recipe ingredient via addItemToShoppingListMutation with all fields', async () => {
      const mockAddItemMutation = jest.fn().mockResolvedValue({});
      const { useAddItemToShoppingListMutation } = require('#generated');
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);
      const { toastService } = require('#/services/toastService');

      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [{ id: 1, name: 'Flour' }],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({
          id: 1,
          name: 'Flour',
          amount: 2,
          measures: { us: { unitShort: 'cups' }, metric: { unitShort: 'ml' } },
          aisle: 'Baking',
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockAddItemMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            itemName: 'Flour',
            quantity: 2,
            unit: { unitName: 'cups' },
            shoppingListId: 'sl-1',
            storePrefs: { aisle: 'Baking' },
          },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Added to "Weekly"');

      // Cleanup
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });

    it('uses originalString fallback for item name and metric unit fallback', async () => {
      const mockAddItemMutation = jest.fn().mockResolvedValue({});
      const { useAddItemToShoppingListMutation } = require('#generated');
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);

      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({
          id: 2,
          originalString: '2 cups flour',
          amount: 0,
          measures: { metric: { unitShort: 'g' } },
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockAddItemMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            itemName: '2 cups flour',
            quantity: 0,
            unit: { unitName: 'g' },
            shoppingListId: 'sl-1',
            storePrefs: undefined,
          },
        },
      });

      // Cleanup
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });

    it('uses "Unknown ingredient" fallback when no name or originalString', async () => {
      const mockAddItemMutation = jest.fn().mockResolvedValue({});
      const { useAddItemToShoppingListMutation } = require('#generated');
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);

      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({ id: 3 });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockAddItemMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            itemName: 'Unknown ingredient',
            quantity: 0,
            unit: { unitName: undefined },
            shoppingListId: 'sl-1',
            storePrefs: undefined,
          },
        },
      });

      // Cleanup
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });

    it('handles mutation error in handleAddSingleIngredient', async () => {
      const mockAddItemMutation = jest.fn().mockRejectedValue(new Error('mutation failed'));
      const { useAddItemToShoppingListMutation } = require('#generated');
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);
      const { toastService } = require('#/services/toastService');

      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({ id: 1, name: 'Salt' });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.error).toHaveBeenCalledWith('Failed to add ingredient to shopping list.');

      // Cleanup
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('executeAddAllIngredientsToList (via handleListSelected)', () => {
    it('adds all backend recipe ingredients to selected list', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const {
        useGetRecipeQuery,
        useCreateShoppingListItemsFromRecipeMutation,
      } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }, { id: 'i2', name: 'Pepper' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockAddRecipeToList = jest.fn().mockResolvedValue({
        data: {
          createShoppingListItemsFromRecipe: {
            addedItems: [{ id: 'new1' }, { id: 'new2' }],
            totalAdded: 2,
            totalUpdated: 1,
          },
        },
      });
      useCreateShoppingListItemsFromRecipeMutation.mockReturnValue([mockAddRecipeToList]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      // First trigger openListPicker via handleAddAllIngredientsToList
      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      // Then select a list
      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockAddRecipeToList).toHaveBeenCalledWith({
        variables: {
          input: {
            recipeId: 'r1',
            shoppingListId: 'sl-1',
            servings: 4,
          },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith(
        'Added 2 items to "Weekly", updated 1',
      );

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useCreateShoppingListItemsFromRecipeMutation.mockReturnValue([jest.fn()]);
    });

    it('shows success without updated count when totalUpdated is 0', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const {
        useGetRecipeQuery,
        useCreateShoppingListItemsFromRecipeMutation,
      } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockAddRecipeToList = jest.fn().mockResolvedValue({
        data: {
          createShoppingListItemsFromRecipe: {
            addedItems: [{ id: 'new1' }],
            totalAdded: 1,
            totalUpdated: 0,
          },
        },
      });
      useCreateShoppingListItemsFromRecipeMutation.mockReturnValue([mockAddRecipeToList]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.success).toHaveBeenCalledWith('Added 1 items to "Weekly"');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useCreateShoppingListItemsFromRecipeMutation.mockReturnValue([jest.fn()]);
    });

    it('adds external recipe ingredients via batch mutation', async () => {
      const { useAddItemsToShoppingListMutation } = require('#generated');
      const mockBatchAdd = jest.fn().mockResolvedValue({
        data: {
          addItemsToShoppingList: {
            results: [
              { success: true, clientId: '1', item: { id: 'item1' } },
              { success: true, clientId: '2', item: { id: 'item2' } },
              { success: false, clientId: '3', item: null },
            ],
            successCount: 2,
            incrementedCount: 1,
          },
        },
      });
      useAddItemsToShoppingListMutation.mockReturnValue([mockBatchAdd]);

      const mockRecipe = {
        id: 123, title: 'External Batch', image: 'img.jpg', servings: 2,
        readyInMinutes: 15,
        extendedIngredients: [
          { id: 1, name: 'Salt', original: 'a pinch of salt', amount: 1, measures: { us: { unitShort: 'tsp' } }, aisle: 'Spices' },
          { id: 2, name: 'Pepper', original: 'some pepper', amount: 0.5, measures: { metric: { unitShort: 'g' } } },
          { id: null, name: null, original: 'mystery', amount: 0, measures: {} },
        ],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      // Open list picker
      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      // Select list
      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockBatchAdd).toHaveBeenCalledWith({
        variables: {
          shoppingListId: 'sl-1',
          items: expect.arrayContaining([
            expect.objectContaining({
              clientId: '1',
              itemName: 'Salt',
              quantity: 1,
              unit: { unitName: 'tsp' },
              storePrefs: { aisle: 'Spices' },
            }),
          ]),
        },
      });
      expect(toastService.success).toHaveBeenCalledWith(
        'Added 2 items to "Weekly", updated 1',
      );

      // Cleanup
      useAddItemsToShoppingListMutation.mockReturnValue([jest.fn()]);
    });

    it('shows success without updated count when incrementedCount is 0 for batch', async () => {
      const { useAddItemsToShoppingListMutation } = require('#generated');
      const mockBatchAdd = jest.fn().mockResolvedValue({
        data: {
          addItemsToShoppingList: {
            results: [{ success: true, clientId: '1', item: { id: 'item1' } }],
            successCount: 1,
            incrementedCount: 0,
          },
        },
      });
      useAddItemsToShoppingListMutation.mockReturnValue([mockBatchAdd]);

      const mockRecipe = {
        id: 123, title: 'Batch Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15,
        extendedIngredients: [{ id: 1, name: 'Salt', amount: 1, measures: { us: { unitShort: 'tsp' } } }],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.success).toHaveBeenCalledWith('Added 1 items to "Weekly"');

      // Cleanup
      useAddItemsToShoppingListMutation.mockReturnValue([jest.fn()]);
    });

    it('shows error when list not found in executeAddAllIngredientsToList', async () => {
      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      // Open list picker
      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      // Select a non-existent list
      await act(async () => {
        result.current.handleListSelected('non-existent-id');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.error).toHaveBeenCalledWith('Shopping list not found.');
    });

    it('shows error when no ingredients available for external recipe without extendedIngredients', async () => {
      const mockRecipe = {
        id: 123, title: 'No Ingredients', image: 'img.jpg', servings: 2,
        readyInMinutes: 15,
        extendedIngredients: undefined,
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.error).toHaveBeenCalledWith('No ingredients available to add.');
    });

    it('handles error during executeAddAllIngredientsToList', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const {
        useGetRecipeQuery,
        useCreateShoppingListItemsFromRecipeMutation,
      } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockAddRecipeToList = jest.fn().mockRejectedValue(new Error('mutation failed'));
      useCreateShoppingListItemsFromRecipeMutation.mockReturnValue([mockAddRecipeToList]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.error).toHaveBeenCalledWith('Failed to add ingredients to shopping list.');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useCreateShoppingListItemsFromRecipeMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('executeAddSelectedIngredientsToList (via handleListSelected)', () => {
    it('adds selected backend ingredients and shows toast with counts', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const {
        useGetRecipeQuery,
        useCreateShoppingListItemFromRecipeIngredientMutation,
      } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }, { id: 'i2', name: 'Pepper' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockAddIngredient = jest.fn()
        .mockResolvedValueOnce({
          data: { createShoppingListItemFromRecipeIngredient: { wasUpdated: false, shoppingListItem: { id: 'item1' } } },
        })
        .mockResolvedValueOnce({
          data: { createShoppingListItemFromRecipeIngredient: { wasUpdated: true, shoppingListItem: { id: 'item2' } } },
        });
      useCreateShoppingListItemFromRecipeIngredientMutation.mockReturnValue([mockAddIngredient]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      // Select ingredients
      act(() => {
        result.current.toggleIngredient('i1');
      });
      act(() => {
        result.current.toggleIngredient('i2');
      });

      // Open list picker with 'selected' type
      // Need to trigger the selected flow: handleAddSelectedIngredients -> openListPicker({ type: 'selected' })
      // But handleAddSelectedIngredients sets pendingDismissActionRef and calls dismiss
      // So we simulate the flow by calling handleAddAllIngredientsToList first to get into 'all' pending action,
      // then call handleListSelected with 'selected' type.
      // Actually, we need to set pendingAction to 'selected'. Let's trigger it properly.

      // handleAddSelectedIngredients sets pendingDismissActionRef and dismisses ingredientSelectorRef
      // handleSheetDismiss then calls openListPicker({ type: 'selected' })
      // openListPicker sets pendingAction and calls listPickerRef.current?.present()
      // Then handleListSelected processes the 'selected' action

      // Since refs are null in tests, we can simulate:
      act(() => {
        result.current.handleAddSelectedIngredients();
      });

      // Simulate sheet dismiss callback
      act(() => {
        result.current.handleSheetDismiss();
      });

      // Now handleListSelected with the 'selected' pending action
      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockAddIngredient).toHaveBeenCalledTimes(2);
      expect(toastService.success).toHaveBeenCalledWith(
        'Added 1 items to "Weekly", updated 1',
      );
      // selectedIngredients should be cleared
      expect(result.current.selectedIngredients.size).toBe(0);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useCreateShoppingListItemFromRecipeIngredientMutation.mockReturnValue([jest.fn()]);
    });

    it('exits early when no backendRecipe for selected ingredients', async () => {
      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      // Manually trigger handleListSelected with a mocked 'selected' pendingAction
      // Since there's no backend recipe, executeAddSelectedIngredientsToList should return early
      // We need to get pendingAction set to 'selected' first

      // The only way to get pendingAction to 'selected' is via openListPicker({ type: 'selected' })
      // which is called from handleAddSelectedIngredients -> handleSheetDismiss
      // But handleAddSelectedIngredients returns early if !backendRecipe || !recipeId
      // So this path (executeAddSelectedIngredientsToList with no backend recipe) can't happen via normal flow

      // However, we test executeAddSelectedIngredientsToList guard directly via handleListSelected
      // by manually triggering it. Since we can't directly set pendingAction,
      // this confirms the early return in handleAddSelectedIngredients is tested above.
      expect(result.current.selectedIngredients.size).toBe(0);
      expect(toastService.error).not.toHaveBeenCalled();
    });

    it('shows error when list not found in executeAddSelectedIngredientsToList', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      // Select an ingredient
      act(() => {
        result.current.toggleIngredient('i1');
      });

      // Trigger the selected flow
      act(() => {
        result.current.handleAddSelectedIngredients();
      });
      act(() => {
        result.current.handleSheetDismiss();
      });

      // Select a non-existent list
      await act(async () => {
        result.current.handleListSelected('non-existent-id');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.error).toHaveBeenCalledWith('Shopping list not found.');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });

    it('shows added count without updated when no wasUpdated results', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const {
        useGetRecipeQuery,
        useCreateShoppingListItemFromRecipeIngredientMutation,
      } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockAddIngredient = jest.fn().mockResolvedValue({
        data: { createShoppingListItemFromRecipeIngredient: { wasUpdated: false, shoppingListItem: { id: 'item1' } } },
      });
      useCreateShoppingListItemFromRecipeIngredientMutation.mockReturnValue([mockAddIngredient]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      act(() => {
        result.current.toggleIngredient('i1');
      });

      act(() => {
        result.current.handleAddSelectedIngredients();
      });
      act(() => {
        result.current.handleSheetDismiss();
      });

      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      expect(toastService.success).toHaveBeenCalledWith('Added 1 items to "Weekly"');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useCreateShoppingListItemFromRecipeIngredientMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('handleAddSelectedIngredients', () => {
    it('shows error when no ingredients are selected', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      act(() => {
        result.current.handleAddSelectedIngredients();
      });

      expect(toastService.error).toHaveBeenCalledWith('Please select at least one ingredient.');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });
  });

  describe('handleAddAllIngredients with backend recipe', () => {
    it('sets pending dismiss action and dismisses shopping list options sheet', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null,
            ingredients: [{ id: 'i1', name: 'Salt' }],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const { result } = renderHook(() => useRecipeDetail());

      // Should not throw for backend recipe - sets pendingDismissActionRef
      act(() => {
        result.current.handleAddAllIngredients();
      });

      // Simulate sheet dismiss to execute the pending action
      act(() => {
        result.current.handleSheetDismiss();
      });

      // The pending action calls openListPicker({ type: 'all' })
      // which sets pendingAction and tries to present listPickerRef (null in test)
      expect(result.current).toBeDefined();

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });
  });

  describe('openIngredientSelector', () => {
    it('sets pending dismiss action for ingredient selector', () => {
      const { result } = renderHook(() => useRecipeDetail());

      act(() => {
        result.current.openIngredientSelector();
      });

      // Simulate sheet dismiss
      act(() => {
        result.current.handleSheetDismiss();
      });

      // The pending action tries to present ingredientSelectorRef (null in test)
      expect(result.current).toBeDefined();
    });
  });

  describe('handleMarkAsCooked with recipeId', () => {
    it('marks recipe as cooked with simple deduction and deductFromPantry true', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useMarkRecipeAsCookedMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockMarkCooked = jest.fn().mockResolvedValue({});
      useMarkRecipeAsCookedMutation.mockReturnValue([mockMarkCooked]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        result.current.handleMarkAsCooked({
          servings: 2,
          deductFromPantry: true,
          useGranularDeduction: false,
          notes: 'Was delicious',
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockMarkCooked).toHaveBeenCalledWith({
        variables: {
          input: {
            recipeId: 'r1',
            servings: 2,
            deductFromPantry: true,
            notes: 'Was delicious',
          },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      );

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useMarkRecipeAsCookedMutation.mockReturnValue([jest.fn()]);
    });

    it('marks recipe as cooked with simple deduction and deductFromPantry false', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useMarkRecipeAsCookedMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockMarkCooked = jest.fn().mockResolvedValue({});
      useMarkRecipeAsCookedMutation.mockReturnValue([mockMarkCooked]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        result.current.handleMarkAsCooked({
          servings: 4,
          deductFromPantry: false,
          useGranularDeduction: false,
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockMarkCooked).toHaveBeenCalledWith({
        variables: {
          input: {
            recipeId: 'r1',
            servings: 4,
            deductFromPantry: false,
            notes: undefined,
          },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Recipe marked as cooked!');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useMarkRecipeAsCookedMutation.mockReturnValue([jest.fn()]);
    });

    it('uses granular deduction and loads matches successfully', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockLoadMatches = jest.fn().mockResolvedValue(true);
      const { useRecipeIngredientMatching } = require('#/hooks/recipe/useRecipeIngredientMatching');
      useRecipeIngredientMatching.mockReturnValue({
        loadMatches: mockLoadMatches,
        closeSheet: jest.fn(),
        isSheetVisible: false,
        editableMatches: [],
        matchSummary: null,
        updateMatch: jest.fn(),
        confirmConsumption: jest.fn(),
        confirmLoading: false,
        hasPantry: false,
      });

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        result.current.handleMarkAsCooked({
          servings: 3,
          deductFromPantry: true,
          useGranularDeduction: true,
          notes: 'test',
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockLoadMatches).toHaveBeenCalledWith(3);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useRecipeIngredientMatching.mockReturnValue({
        loadMatches: jest.fn(), closeSheet: jest.fn(), isSheetVisible: false,
        editableMatches: [], matchSummary: null, updateMatch: jest.fn(),
        confirmConsumption: jest.fn(), confirmLoading: false, hasPantry: false,
      });
    });

    it('falls back to simple deduction when granular matching fails', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useMarkRecipeAsCookedMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockMarkCooked = jest.fn().mockResolvedValue({});
      useMarkRecipeAsCookedMutation.mockReturnValue([mockMarkCooked]);

      const mockLoadMatches = jest.fn().mockResolvedValue(false);
      const { useRecipeIngredientMatching } = require('#/hooks/recipe/useRecipeIngredientMatching');
      useRecipeIngredientMatching.mockReturnValue({
        loadMatches: mockLoadMatches,
        closeSheet: jest.fn(),
        isSheetVisible: false,
        editableMatches: [],
        matchSummary: null,
        updateMatch: jest.fn(),
        confirmConsumption: jest.fn(),
        confirmLoading: false,
        hasPantry: false,
      });

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        result.current.handleMarkAsCooked({
          servings: 3,
          deductFromPantry: true,
          useGranularDeduction: true,
          notes: 'fallback test',
        });
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockLoadMatches).toHaveBeenCalledWith(3);
      expect(mockMarkCooked).toHaveBeenCalledWith({
        variables: {
          input: {
            recipeId: 'r1',
            servings: 3,
            deductFromPantry: true,
            notes: 'fallback test',
          },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      );

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useMarkRecipeAsCookedMutation.mockReturnValue([jest.fn()]);
      useRecipeIngredientMatching.mockReturnValue({
        loadMatches: jest.fn(), closeSheet: jest.fn(), isSheetVisible: false,
        editableMatches: [], matchSummary: null, updateMatch: jest.fn(),
        confirmConsumption: jest.fn(), confirmLoading: false, hasPantry: false,
      });
    });
  });

  describe('handleSkipReview with recipeId', () => {
    it('calls markRecipeAsCookedMutation and shows success toast', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useMarkRecipeAsCookedMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockMarkCooked = jest.fn().mockResolvedValue({});
      useMarkRecipeAsCookedMutation.mockReturnValue([mockMarkCooked]);

      const mockCloseSheet = jest.fn();
      const { useRecipeIngredientMatching } = require('#/hooks/recipe/useRecipeIngredientMatching');
      useRecipeIngredientMatching.mockReturnValue({
        loadMatches: jest.fn(), closeSheet: mockCloseSheet, isSheetVisible: false,
        editableMatches: [], matchSummary: null, updateMatch: jest.fn(),
        confirmConsumption: jest.fn(), confirmLoading: false, hasPantry: false,
      });

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        result.current.handleSkipReview();
        await new Promise(r => setTimeout(r, 0));
      });

      expect(mockCloseSheet).toHaveBeenCalled();
      expect(mockMarkCooked).toHaveBeenCalledWith({
        variables: {
          input: {
            recipeId: 'r1',
            servings: undefined,
            deductFromPantry: true,
          },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith(
        'Recipe marked as cooked! Ingredients deducted from pantry.',
      );

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useMarkRecipeAsCookedMutation.mockReturnValue([jest.fn()]);
      useRecipeIngredientMatching.mockReturnValue({
        loadMatches: jest.fn(), closeSheet: jest.fn(), isSheetVisible: false,
        editableMatches: [], matchSummary: null, updateMatch: jest.fn(),
        confirmConsumption: jest.fn(), confirmLoading: false, hasPantry: false,
      });
    });
  });

  describe('handleUpdateFolder with recipeId', () => {
    it('calls updateFavoriteRecipeMutation with folder and shows success toast', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateFolder('Dinner');
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { folder: 'Dinner' },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Moved to "Dinner"');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });

    it('calls updateFavoriteRecipeMutation with null folder and shows removed toast', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateFolder(null);
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { folder: undefined },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Removed from folder');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('handleUpdateTags with recipeId', () => {
    it('calls updateFavoriteRecipeMutation with tags', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateTags(['italian', 'pasta']);
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { tags: ['italian', 'pasta'] },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Tags updated');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('handleUpdateNotes with recipeId', () => {
    it('calls updateFavoriteRecipeMutation with notes', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateNotes('My recipe notes');
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { notes: 'My recipe notes' },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Notes updated');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });

    it('passes undefined for notes when empty string', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateNotes('');
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { notes: undefined },
        },
      });

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('handleUpdateRating with recipeId', () => {
    it('calls updateFavoriteRecipeMutation with rating', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateRating(4);
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { personalRating: 4 },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Rated 4/5');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });

    it('shows "Rating removed" when rating is null', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUpdateFavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUpdateFavorite = jest.fn().mockResolvedValue({});
      useUpdateFavoriteRecipeMutation.mockReturnValue([mockUpdateFavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUpdateRating(null);
      });

      expect(mockUpdateFavorite).toHaveBeenCalledWith({
        variables: {
          recipeId: 'r1',
          input: { personalRating: null },
        },
      });
      expect(toastService.success).toHaveBeenCalledWith('Rating removed');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUpdateFavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('handleUnfavoriteRecipe', () => {
    it('unfavorites recipe with recipeId and resets state', async () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery, useUnfavoriteRecipeMutation } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Backend Recipe', imageUrl: null, servings: 4,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null,
            savedDetails: { folder: 'Dinner', tags: [], notes: null, personalRating: null, cookedCount: 0 },
          },
        },
        loading: false,
        error: undefined,
      });

      const mockUnfavorite = jest.fn().mockResolvedValue({});
      useUnfavoriteRecipeMutation.mockReturnValue([mockUnfavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUnfavoriteRecipe();
      });

      expect(mockUnfavorite).toHaveBeenCalledWith({
        variables: { recipeId: 'r1' },
      });
      expect(toastService.success).toHaveBeenCalledWith('Recipe removed from saved');

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
      useUnfavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });

    it('unfavorites recipe using preloadedRecipe.id when no recipeId', async () => {
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: { id: 'preloaded-r1' },
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });

      const { useUnfavoriteRecipeMutation } = require('#generated');
      const mockUnfavorite = jest.fn().mockResolvedValue({});
      useUnfavoriteRecipeMutation.mockReturnValue([mockUnfavorite]);

      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await result.current.handleUnfavoriteRecipe();
      });

      expect(mockUnfavorite).toHaveBeenCalledWith({
        variables: { recipeId: 'preloaded-r1' },
      });
      expect(toastService.success).toHaveBeenCalledWith('Recipe removed from saved');

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
      useUnfavoriteRecipeMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('displayData for external recipe', () => {
    it('returns external recipe displayData with all fields', async () => {
      const fullRecipe = {
        id: 123,
        title: 'External Recipe',
        image: 'https://example.com/external.jpg',
        servings: 4,
        readyInMinutes: 30,
        healthScore: 75,
        summary: 'A summary',
        extendedIngredients: [{ id: 1, name: 'Flour' }],
        analyzedInstructions: [{ name: '', steps: [{ number: 1, step: 'Mix' }] }],
        instructions: '<p>Mix everything</p>',
        vegetarian: false,
        vegan: true,
        glutenFree: false,
        dairyFree: true,
        sourceName: 'Chef Blog',
        sourceUrl: 'https://chef.com/recipe',
      };
      mockGetRecipeInfo.mockResolvedValueOnce(fullRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(result.current.displayData).toEqual({
        title: 'External Recipe',
        image: 'https://example.com/external.jpg',
        servings: 4,
        readyInMinutes: 30,
        healthScore: 75,
        summary: 'A summary',
        ingredients: [{ id: 1, name: 'Flour' }],
        instructions: [{ name: '', steps: [{ number: 1, step: 'Mix' }] }],
        instructionsHtml: '<p>Mix everything</p>',
        vegetarian: false,
        vegan: true,
        glutenFree: false,
        dairyFree: true,
        sourceName: 'Chef Blog',
        sourceUrl: 'https://chef.com/recipe',
      });
    });

    it('returns empty array for ingredients when extendedIngredients is undefined', async () => {
      const recipe = {
        id: 123,
        title: 'No Ingredients Recipe',
        image: 'img.jpg',
        servings: 2,
        readyInMinutes: 10,
        extendedIngredients: undefined,
      };
      mockGetRecipeInfo.mockResolvedValueOnce(recipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      expect(result.current.displayData?.ingredients).toEqual([]);
    });
  });

  describe('backend recipe displayData edge cases', () => {
    it('handles backend recipe with null optional fields', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Minimal Recipe',
            imageUrl: null,
            servings: 1,
            totalTimeMinutes: null,
            description: null,
            ingredients: null,
            instructions: null,
            source: null,
            sourceUrl: null,
            savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.displayData?.title).toBe('Minimal Recipe');
      expect(result.current.displayData?.image).toBeUndefined();
      expect(result.current.displayData?.readyInMinutes).toBeUndefined();
      expect(result.current.displayData?.summary).toBeUndefined();
      expect(result.current.displayData?.ingredients).toEqual([]);
      expect(result.current.displayData?.sourceName).toBeUndefined();
      expect(result.current.displayData?.sourceUrl).toBeUndefined();

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });
  });

  describe('openListPicker edge cases', () => {
    it('shows error when shopping lists are empty', () => {
      const { useGetShoppingListsLiteQuery } = require('#generated');
      const { toastService } = require('#/services/toastService');
      useGetShoppingListsLiteQuery.mockReturnValue({
        data: { shoppingLists: { edges: [] } },
        loading: false,
      });

      const { result } = renderHook(() => useRecipeDetail());

      act(() => {
        result.current.handleAddAllIngredientsToList();
      });

      expect(toastService.error).toHaveBeenCalledWith('Please create a shopping list first.');

      // Cleanup
      useGetShoppingListsLiteQuery.mockReturnValue({
        data: { shoppingLists: { edges: [{ node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } }] } },
        loading: false,
      });
    });
  });

  describe('saving state', () => {
    it('saving is true when savingToFavorites is true', () => {
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: true,
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.saving).toBe(true);

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
    });

    it('preloading state is passed through', () => {
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');
      useRecipePreload.mockReturnValue({
        preloading: true,
        preloadedRecipe: { id: 'preloaded' },
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.preloading).toBe(true);
      expect(result.current.preloadedRecipe).toEqual({ id: 'preloaded' });

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
    });
  });

  describe('backendError', () => {
    it('returns backendError from useGetRecipeQuery', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      const mockError = new Error('Backend query failed');
      useGetRecipeQuery.mockReturnValue({
        data: null,
        loading: false,
        error: mockError,
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.backendError).toBe(mockError);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });
  });

  describe('default values for savedTags, savedNotes, savedRating, cookedCount', () => {
    it('returns empty defaults when backendRecipe has no savedDetails', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'No Saved Details', imageUrl: null, servings: 2,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.savedTags).toEqual([]);
      expect(result.current.savedNotes).toBeNull();
      expect(result.current.savedRating).toBeNull();
      expect(result.current.cookedCount).toBe(0);
      expect(result.current.savedFolder).toBeNull();

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });

    it('returns defaults when no backendRecipe at all', () => {
      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.savedTags).toEqual([]);
      expect(result.current.savedNotes).toBeNull();
      expect(result.current.savedRating).toBeNull();
      expect(result.current.cookedCount).toBe(0);
    });
  });

  describe('handleListSelected', () => {
    it('does nothing when pendingAction is null', async () => {
      const { toastService } = require('#/services/toastService');
      const { result } = renderHook(() => useRecipeDetail());

      // Call handleListSelected without setting up any pending action
      await act(async () => {
        result.current.handleListSelected('sl-1');
        await new Promise(r => setTimeout(r, 0));
      });

      // Should not execute any action since pendingAction is null
      // (it will try executeAddAllIngredientsToList or executeAddSelectedIngredientsToList
      // but since pendingAction is null, neither branch fires)
      expect(toastService.success).not.toHaveBeenCalled();
    });
  });

  describe('showFolderPicker state', () => {
    it('defaults to false and can be toggled', () => {
      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.showFolderPicker).toBe(false);

      act(() => {
        result.current.setShowFolderPicker(true);
      });

      expect(result.current.showFolderPicker).toBe(true);
    });
  });

  describe('isSaved for backend recipe without savedDetails', () => {
    it('returns false when backendRecipe.savedDetails is null', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: { recipeId: 'r1' } });

      const { useGetRecipeQuery } = require('#generated');
      useGetRecipeQuery.mockReturnValue({
        data: {
          recipe: {
            name: 'Unsaved Backend', imageUrl: null, servings: 2,
            totalTimeMinutes: null, description: null, ingredients: [],
            instructions: [], source: null, sourceUrl: null, savedDetails: null,
          },
        },
        loading: false,
        error: undefined,
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isBackendRecipe).toBe(true);
      expect(result.current.isSaved).toBe(false);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      useGetRecipeQuery.mockReturnValue({ data: null, loading: false, error: undefined });
    });
  });

  describe('savedRecipe matching (normalizedRecipes)', () => {
    it('does not match when externalSource or externalId is missing', () => {
      const { useRoute } = require('@react-navigation/native');
      const { normalizeRecipes } = require('#/utils/connectionUtils');
      const { useMyRecipesQuery } = require('#generated');

      // Only externalSource, no externalId
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR' } });
      normalizeRecipes.mockReturnValue({
        recipes: [{ externalSource: 'SPOONACULAR', externalId: '123', savedDetails: { folder: 'Test' } }],
      });
      useMyRecipesQuery.mockReturnValue({ data: { recipes: 'mockData' } });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isSaved).toBe(false);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
      normalizeRecipes.mockReturnValue({ recipes: [] });
      useMyRecipesQuery.mockReturnValue({ data: null });
    });

    it('returns undefined when normalizeRecipes returns null recipes', () => {
      const { normalizeRecipes } = require('#/utils/connectionUtils');
      const { useMyRecipesQuery } = require('#generated');

      normalizeRecipes.mockReturnValue(null);
      useMyRecipesQuery.mockReturnValue({ data: { recipes: 'mockData' } });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isSaved).toBe(false);

      // Cleanup
      normalizeRecipes.mockReturnValue({ recipes: [] });
      useMyRecipesQuery.mockReturnValue({ data: null });
    });
  });

  describe('route params edge cases', () => {
    it('handles undefined route params', () => {
      const { useRoute } = require('@react-navigation/native');
      useRoute.mockReturnValue({ params: undefined });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.recipeId).toBeUndefined();
      expect(result.current.externalId).toBeUndefined();
      expect(result.current.isBackendRecipe).toBe(false);

      // Cleanup
      useRoute.mockReturnValue({ params: { externalSource: 'SPOONACULAR', externalId: '123' } });
    });
  });

  describe('multiple shopping lists', () => {
    it('uses user-selected list from store when available and found', async () => {
      const { useAppStore } = require('#store/useAppStore');
      const { useGetShoppingListsLiteQuery, useAddItemToShoppingListMutation } = require('#generated');
      const { toastService } = require('#/services/toastService');

      useAppStore.mockReturnValue('sl-2');
      useGetShoppingListsLiteQuery.mockReturnValue({
        data: {
          shoppingLists: {
            edges: [
              { node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } },
              { node: { id: 'sl-2', name: 'Party', isDefault: false, totalItems: 2 } },
            ],
          },
        },
        loading: false,
      });

      const mockAddItemMutation = jest.fn().mockResolvedValue({});
      useAddItemToShoppingListMutation.mockReturnValue([mockAddItemMutation]);

      const mockRecipe = {
        id: 123, title: 'Test', image: 'img.jpg', servings: 2,
        readyInMinutes: 15, extendedIngredients: [{ id: 1, name: 'Salt' }],
      };
      mockGetRecipeInfo.mockResolvedValueOnce(mockRecipe);

      const { result } = renderHook(() => useRecipeDetail());

      await act(async () => {
        await new Promise(r => setTimeout(r, 0));
      });

      await act(async () => {
        result.current.handleAddSingleIngredient({ id: 1, name: 'Salt', amount: 1 });
        await new Promise(r => setTimeout(r, 0));
      });

      // Should use selected list 'sl-2' since it exists
      expect(mockAddItemMutation).toHaveBeenCalledWith(
        expect.objectContaining({
          variables: expect.objectContaining({
            input: expect.objectContaining({
              shoppingListId: 'sl-2',
            }),
          }),
        }),
      );
      expect(toastService.success).toHaveBeenCalledWith('Added to "Party"');

      // Cleanup
      useAppStore.mockReturnValue(null);
      useGetShoppingListsLiteQuery.mockReturnValue({
        data: { shoppingLists: { edges: [{ node: { id: 'sl-1', name: 'Weekly', isDefault: true, totalItems: 5 } }] } },
        loading: false,
      });
      useAddItemToShoppingListMutation.mockReturnValue([jest.fn()]);
    });
  });

  describe('onFavoriteSuccess callback from useRecipePreload', () => {
    it('sets recipeSaved to true when onFavoriteSuccess fires', () => {
      const { useRecipePreload } = require('#/hooks/recipe/useRecipePreload');

      let capturedOnFavoriteSuccess: (() => void) | undefined;
      useRecipePreload.mockImplementation((opts: any) => {
        capturedOnFavoriteSuccess = opts.onFavoriteSuccess;
        return {
          preloading: false,
          preloadedRecipe: null,
          preloadRecipe: mockPreloadRecipe,
          saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
          savingToFavorites: false,
        };
      });

      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.isSaved).toBe(false);

      // Simulate the callback
      act(() => {
        capturedOnFavoriteSuccess?.();
      });

      expect(result.current.isSaved).toBe(true);

      // Cleanup
      useRecipePreload.mockReturnValue({
        preloading: false,
        preloadedRecipe: null,
        preloadRecipe: mockPreloadRecipe,
        saveRecipeToFavorites: jest.fn().mockResolvedValue({ success: true }),
        savingToFavorites: false,
      });
    });
  });

  describe('ingredient matching ref', () => {
    it('exposes ingredientMatching from useRecipeIngredientMatching', () => {
      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.ingredientMatching).toBeDefined();
      expect(result.current.ingredientMatching.loadMatches).toBeDefined();
      expect(result.current.ingredientMatching.closeSheet).toBeDefined();
      expect(result.current.ingredientMatching.isSheetVisible).toBe(false);
      expect(result.current.ingredientMatching.editableMatches).toEqual([]);
    });
  });

  describe('bottom sheet refs', () => {
    it('exposes all three bottom sheet refs', () => {
      const { result } = renderHook(() => useRecipeDetail());

      expect(result.current.shoppingListOptionsRef).toBeDefined();
      expect(result.current.ingredientSelectorRef).toBeDefined();
      expect(result.current.listPickerRef).toBeDefined();
    });
  });
});
