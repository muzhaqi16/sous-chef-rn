import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import { MyRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeFavoriteState } from '../useRecipeFavoriteState';

function seedRecipeCache(
  recipes: Array<{
    id: string;
    externalSource: string;
    externalId: string;
    folder?: string;
  }>,
) {
  return seedCache(
    recipes.map(r => ({
      __typename: 'Recipe',
      id: r.id,
      name: `Recipe ${r.id}`,
      description: null,
      imageUrl: null,
      servings: 1,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
      difficulty: 'EASY',
      category: 'DINNER',
      cuisine: null,
      status: 'PUBLISHED',
      isExternal: true,
      externalSource: r.externalSource,
      externalId: r.externalId,
      primarySource: null,
      caloriesPerServing: null,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      savedDetails: r.folder
        ? {
            __typename: 'SavedRecipe',
            id: `sd-${r.id}`,
            folder: r.folder,
            tags: [],
            notes: null,
            personalRating: null,
            cookedCount: 0,
          }
        : null,
    })),
  );
}

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(
    async (fn: any, setLoading: any, onError: any) => {
      setLoading(true);
      try {
        await fn();
      } catch (e) {
        onError?.(e);
      } finally {
        setLoading(false);
      }
    },
  ),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

function myRecipesMock(
  recipes: Array<{
    id: string;
    externalSource: string;
    externalId: string;
    folder?: string;
  }> = [],
) {
  return recordMock(MyRecipesDocument, {
    data: {
      recipes: {
        __typename: 'RecipeConnection',
        edges: recipes.map((r, i) => ({
          __typename: 'RecipeEdge',
          cursor: `c${i}`,
          node: {
            __typename: 'Recipe',
            id: r.id,
            name: `Recipe ${r.id}`,
            description: null,
            imageUrl: null,
            servings: 1,
            prepTimeMinutes: null,
            cookTimeMinutes: null,
            totalTimeMinutes: null,
            difficulty: 'EASY',
            category: 'DINNER',
            cuisine: null,
            status: 'PUBLISHED',
            isExternal: true,
            externalSource: r.externalSource,
            externalId: r.externalId,
            primarySource: null,
            caloriesPerServing: null,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
            savedDetails: r.folder
              ? {
                  __typename: 'SavedRecipe',
                  id: `sd-${r.id}`,
                  folder: r.folder,
                  tags: [],
                  notes: null,
                  personalRating: null,
                  cookedCount: 0,
                }
              : null,
          },
        })),
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: recipes.length,
      },
    },
  });
}

const minimalExternalRecipe = {
  id: 12345,
  title: 'External',
} as any;

const noopSave = jest.fn();

describe('useRecipeFavoriteState', () => {
  describe('isSaved derivation', () => {
    it('returns true for backend recipe with savedDetails', () => {
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: undefined,
          externalId: undefined,
          externalRecipe: null,
          isBackendRecipe: true,
          backendRecipe: {
            id: 'r1',
            savedDetails: { folder: 'F' },
          } as any,
          saveRecipeToFavorites: noopSave,
          savingToFavorites: false,
        }),
      );

      expect(result.current.isSaved).toBe(true);
    });

    it('returns false for backend recipe without savedDetails', () => {
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: undefined,
          externalId: undefined,
          externalRecipe: null,
          isBackendRecipe: true,
          backendRecipe: { id: 'r1', savedDetails: null } as any,
          saveRecipeToFavorites: noopSave,
          savingToFavorites: false,
        }),
      );

      expect(result.current.isSaved).toBe(false);
    });

    it('returns true for external recipe found in MyRecipes', async () => {
      const recipes = [
        {
          id: 'saved-1',
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          folder: 'Dinner',
        },
      ];
      const m = myRecipesMock(recipes);
      const cache = seedRecipeCache(recipes);

      const { result } = renderHookWithApollo(
        () =>
          useRecipeFavoriteState({
            externalSource: 'SPOONACULAR',
            externalId: '12345',
            externalRecipe: minimalExternalRecipe,
            isBackendRecipe: false,
            backendRecipe: undefined,
            saveRecipeToFavorites: noopSave,
            savingToFavorites: false,
          }),
        { operationMocks: [m.mock], cache },
      );

      await waitFor(() => expect(result.current.isSaved).toBe(true));
      expect(result.current.savedFolderLocal).toBe('Dinner');
    });

    it('returns false for external recipe not found in MyRecipes', async () => {
      const m = myRecipesMock([]);

      const { result } = renderHookWithApollo(
        () =>
          useRecipeFavoriteState({
            externalSource: 'SPOONACULAR',
            externalId: '99999',
            externalRecipe: minimalExternalRecipe,
            isBackendRecipe: false,
            backendRecipe: undefined,
            saveRecipeToFavorites: noopSave,
            savingToFavorites: false,
          }),
        { operationMocks: [m.mock] },
      );

      await waitFor(() => expect(result.current.isSaved).toBe(false));
      expect(result.current.savedFolderLocal).toBeNull();
    });
  });

  describe('handleSaveRecipe', () => {
    it('does nothing when externalRecipe is null', async () => {
      const save = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          externalRecipe: null,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: save,
          savingToFavorites: false,
        }),
      );

      await act(async () => {
        result.current.handleSaveRecipe('Dinner', ['quick'], 'tasty');
      });

      expect(save).not.toHaveBeenCalled();
    });

    it('calls saveRecipeToFavorites with mapped options', async () => {
      const save = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          externalRecipe: minimalExternalRecipe,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: save,
          savingToFavorites: false,
        }),
      );

      await act(async () => {
        result.current.handleSaveRecipe('Dinner', ['quick'], 'tasty');
      });

      expect(save).toHaveBeenCalledWith(minimalExternalRecipe, {
        folder: 'Dinner',
        tags: ['quick'],
        notes: 'tasty',
      });
    });

    it('omits empty tags and notes', async () => {
      const save = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          externalRecipe: minimalExternalRecipe,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: save,
          savingToFavorites: false,
        }),
      );

      await act(async () => {
        result.current.handleSaveRecipe(null, [], '');
      });

      expect(save).toHaveBeenCalledWith(minimalExternalRecipe, {
        folder: undefined,
        tags: undefined,
        notes: undefined,
      });
    });

    it('marks saved on successful save', async () => {
      const save = jest.fn().mockResolvedValue({ success: true });
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          externalRecipe: minimalExternalRecipe,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: save,
          savingToFavorites: false,
        }),
      );

      await act(async () => {
        result.current.handleSaveRecipe('Snacks', undefined, undefined);
      });

      await waitFor(() => expect(result.current.isSaved).toBe(true));
      expect(result.current.savedFolderLocal).toBe('Snacks');
    });

    it('does not mark saved when save returns success: false', async () => {
      const save = jest.fn().mockResolvedValue({ success: false });
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          externalRecipe: minimalExternalRecipe,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: save,
          savingToFavorites: false,
        }),
      );

      await act(async () => {
        result.current.handleSaveRecipe(null, undefined, undefined);
      });

      expect(result.current.isSaved).toBe(false);
    });
  });

  describe('saving flag', () => {
    it('reflects savingToFavorites from props', () => {
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: 'SPOONACULAR',
          externalId: '12345',
          externalRecipe: minimalExternalRecipe,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: noopSave,
          savingToFavorites: true,
        }),
      );

      expect(result.current.saving).toBe(true);
    });
  });

  describe('exposes setters', () => {
    it('exposes setRecipeSaved and setSavedFolderLocal for orchestrator wiring', () => {
      const { result } = renderHookWithApollo(() =>
        useRecipeFavoriteState({
          externalSource: undefined,
          externalId: undefined,
          externalRecipe: null,
          isBackendRecipe: false,
          backendRecipe: undefined,
          saveRecipeToFavorites: noopSave,
          savingToFavorites: false,
        }),
      );

      expect(typeof result.current.setRecipeSaved).toBe('function');
      expect(typeof result.current.setSavedFolderLocal).toBe('function');
    });
  });
});
