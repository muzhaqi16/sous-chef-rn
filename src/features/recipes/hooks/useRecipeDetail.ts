import { useRoute } from '@react-navigation/native';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { useRecipePreload } from '#features/recipes/hooks/useRecipePreload';
import { useRecipeData } from './useRecipeData';
import { useRecipeFavoriteState } from './useRecipeFavoriteState';
import { useRecipeSavedMetadata } from './useRecipeSavedMetadata';
import { useRecipeShoppingList } from './useRecipeShoppingList';
import { useRecipeCookingActions } from './useRecipeCookingActions';

type RecipeDetailParams = {
  recipeId?: string;
  externalSource?: string;
  externalId?: string;
  sourceTab?: 'Pantry' | 'ShoppingList' | 'Recipe';
  sourcePantryItemId?: string;
};

/**
 * Orchestrator that composes the recipe-detail sub-hooks. Each sub-hook owns
 * a narrow concern; this hook just wires them together for the screen.
 */
export function useRecipeDetail() {
  const route = useRoute();
  const params = (route.params as RecipeDetailParams | undefined) ?? {};
  const { recipeId, externalSource, externalId } = params;
  const { goBack } = useAppNavigation();

  const cookingActions = useRecipeCookingActions({ recipeId });

  const preload = useRecipePreload({
    onFavoriteSuccess: () => favorites.setRecipeSaved(true),
  });

  const data = useRecipeData({
    recipeId,
    externalSource,
    externalId,
    preloadRecipe: preload.preloadRecipe,
  });

  const favorites = useRecipeFavoriteState({
    externalSource,
    externalId,
    externalRecipe: data.externalRecipe,
    isBackendRecipe: data.isBackendRecipe,
    backendRecipe: data.backendRecipe,
    saveRecipeToFavorites: preload.saveRecipeToFavorites,
    savingToFavorites: preload.savingToFavorites,
  });

  const shoppingList = useRecipeShoppingList({
    recipeId,
    isBackendRecipe: data.isBackendRecipe,
    backendRecipe: data.backendRecipe,
    externalRecipe: data.externalRecipe,
  });

  const savedMetadata = useRecipeSavedMetadata({
    recipeId,
    preloadedRecipeId: preload.preloadedRecipe?.id,
    onUnfavoriteSuccess: () => {
      favorites.setRecipeSaved(false);
      favorites.setSavedFolderLocal(null);
    },
  });

  return {
    // Navigation
    goBack,
    recipeId,
    externalId,

    // Loading/error states
    loading: data.loading,
    error: data.error,
    backendError: data.backendError,

    // Recipe data
    displayData: data.displayData,
    isBackendRecipe: data.isBackendRecipe,
    backendRecipe: data.backendRecipe,

    // Save state
    saving: favorites.saving,
    isSaved: favorites.isSaved,
    handleSaveRecipe: favorites.handleSaveRecipe,

    // Recipe preload state
    preloading: preload.preloading,
    preloadedRecipe: preload.preloadedRecipe,

    // Shopping list (state + handlers + sheet refs)
    ...shoppingList,

    // Mark as cooked + ingredient matching
    ...cookingActions,

    // Folder/tag editing
    showFolderPicker: savedMetadata.showFolderPicker,
    setShowFolderPicker: savedMetadata.setShowFolderPicker,
    updatingFolderTags: savedMetadata.updatingFolderTags,
    handleUpdateFolder: savedMetadata.handleUpdateFolder,
    handleUpdateTags: savedMetadata.handleUpdateTags,
    handleUpdateNotes: savedMetadata.handleUpdateNotes,
    handleUpdateRating: savedMetadata.handleUpdateRating,
    savedFolder: data.isBackendRecipe
      ? data.backendRecipe?.savedDetails?.folder ?? null
      : favorites.savedFolderLocal,
    savedTags: data.backendRecipe?.savedDetails?.tags ?? [],
    savedNotes: data.backendRecipe?.savedDetails?.notes ?? null,
    savedRating: data.backendRecipe?.savedDetails?.personalRating ?? null,
    cookedCount: data.backendRecipe?.savedDetails?.cookedCount ?? 0,

    // Unfavorite
    handleUnfavoriteRecipe: savedMetadata.handleUnfavoriteRecipe,
  };
}
