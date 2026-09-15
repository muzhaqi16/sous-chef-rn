import { act, waitFor } from '@testing-library/react-native';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MyRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import type { RecipeInformation } from '#/services/spoonacular/types';
import type { MaterializedRecipe } from '#features/recipes/hooks/useRecipeData';
import { useRecipeFavoriteState } from '../useRecipeFavoriteState';

jest.mock('#/utils/finallyHelpers', () => ({
  executeWithLoadingState: jest.fn(
    async (
      fn: () => Promise<void>,
      setLoading: (value: boolean) => void,
      onError?: (error: unknown) => void,
    ) => {
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
    externalSource: ExternalSource;
    externalId: string;
    folder?: string;
  }> = [],
) {
  return recordMock(MyRecipesDocument, {
    data: {
      recipes: {
        edges: recipes.map((r, i) => ({
          cursor: `c${i}`,
          // The provenance and folder the hook matches on arrive on this
          // query's wire; nothing else seeds them.
          node: {
            id: r.id,
            externalSource: r.externalSource,
            externalId: r.externalId,
            savedDetails: r.folder
              ? {
                  id: `sd-${r.id}`,
                  folder: r.folder,
                }
              : null,
          },
        })),
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: recipes.length,
      },
    },
  });
}

const minimalExternalRecipe = {
  id: 12345,
  title: 'External',
} as Partial<RecipeInformation> as RecipeInformation;

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
          } as Partial<MaterializedRecipe> as MaterializedRecipe,
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
          backendRecipe: {
            id: 'r1',
            savedDetails: null,
          } as Partial<MaterializedRecipe> as MaterializedRecipe,
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
          externalSource: ExternalSource.Spoonacular,
          externalId: '12345',
          folder: 'Dinner',
        },
      ];
      const m = myRecipesMock(recipes);

      const { result } = renderHookWithApollo(
        () =>
          useRecipeFavoriteState({
            externalSource: ExternalSource.Spoonacular,
            externalId: '12345',
            externalRecipe: minimalExternalRecipe,
            isBackendRecipe: false,
            backendRecipe: undefined,
            saveRecipeToFavorites: noopSave,
            savingToFavorites: false,
          }),
        { operationMocks: [m.mock] },
      );

      await waitFor(() => expect(result.current.isSaved).toBe(true));
      expect(result.current.savedFolderLocal).toBe('Dinner');
    });

    it('returns false for external recipe not found in MyRecipes', async () => {
      const m = myRecipesMock([]);

      const { result } = renderHookWithApollo(
        () =>
          useRecipeFavoriteState({
            externalSource: ExternalSource.Spoonacular,
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
          externalSource: ExternalSource.Spoonacular,
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
          externalSource: ExternalSource.Spoonacular,
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
          externalSource: ExternalSource.Spoonacular,
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
          externalSource: ExternalSource.Spoonacular,
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
          externalSource: ExternalSource.Spoonacular,
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
          externalSource: ExternalSource.Spoonacular,
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
