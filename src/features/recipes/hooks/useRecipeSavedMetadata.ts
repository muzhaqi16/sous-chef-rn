import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { useMutation } from '@apollo/client/react';
import {
  UpdateFavoriteRecipeDocument,
  RemoveRecipeFromFavoritesDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { removeSavedRecipeFromCache } from '#features/recipes/utils/removeSavedRecipeFromCache';

interface UseRecipeSavedMetadataOptions {
  recipeId: string | undefined;
  /** Falls back to this id when the recipe was saved as an external recipe (no recipeId yet). */
  preloadedRecipeId: string | undefined;
  /** Called after a successful unfavorite so external-recipe state can be cleared by the caller. */
  onUnfavoriteSuccess: () => void;
}

export function useRecipeSavedMetadata({
  recipeId,
  preloadedRecipeId,
  onUnfavoriteSuccess,
}: UseRecipeSavedMetadataOptions) {
  const { t } = useTranslation();
  const isApiUnavailable = useIsApiUnavailable();

  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [updatingFolderTags, setUpdatingFolderTags] = useState(false);

  /** Reports the online-only refusal once, so each handler can bail on `true`. */
  const blockedOffline = (): boolean => {
    if (!isApiUnavailable) return false;
    toastService.error(t('errors.notAvailableOffline'));
    return true;
  };

  const [updateFavoriteRecipeMutation] = useMutation(
    UpdateFavoriteRecipeDocument,
    {
      update: (cache, { data }) => {
        if (
          data?.updateFavoriteRecipe?.__typename !==
          'UpdateFavoriteRecipePayload'
        ) {
          return;
        }
        const updatedSavedRecipe = data.updateFavoriteRecipe.savedRecipe;

        const folder = updatedSavedRecipe.folder;
        if (folder) {
          cache.updateQuery<SavedRecipeFoldersQuery>(
            { query: SavedRecipeFoldersDocument },
            existing => {
              if (!existing) return existing;
              if (existing.savedRecipeFolders.includes(folder)) {
                return existing;
              }
              return {
                ...existing,
                savedRecipeFolders: [...existing.savedRecipeFolders, folder],
              };
            },
          );
        }

        cache.updateQuery<MySavedRecipesQuery>(
          { query: MySavedRecipesDocument },
          existing => {
            if (!existing?.me) return existing;
            return {
              ...existing,
              me: {
                ...existing.me,
                savedRecipesConnection: {
                  ...existing.me.savedRecipesConnection,
                  edges: existing.me.savedRecipesConnection.edges.map(edge =>
                    edge.node.id === updatedSavedRecipe.id
                      ? {
                          ...edge,
                          node: { ...edge.node, ...updatedSavedRecipe },
                        }
                      : edge,
                  ),
                },
              },
            };
          },
        );
      },
      onError: err => {
        errorService.reportError(err, { operation: 'updateFavoriteRecipe' });
        toastService.error(err.message || t('labels.failedToUpdateRecipe'));
      },
    },
  );

  const [unfavoriteRecipeMutation] = useMutation(
    RemoveRecipeFromFavoritesDocument,
    {
      update: (cache, { data }, { variables }) => {
        const payload = data?.removeRecipeFromFavorites;
        if (payload?.__typename !== 'RemoveRecipeFromFavoritesPayload') return;
        const removedRecipeId = variables?.input.recipeId;
        if (!removedRecipeId) return;
        removeSavedRecipeFromCache(cache, removedRecipeId);
      },
    },
  );

  /**
   * One call for all four metadata edits: they differ only in which field they
   * set, and the payload returns the whole `SavedRecipe`, so Apollo normalizes
   * the new value in by itself.
   */
  const applyMetadataUpdate = async (
    input: Record<string, unknown>,
  ): Promise<void> => {
    await updateFavoriteRecipeMutation({
      variables: { input: { recipeId: recipeId!, ...input } },
    });
  };

  const handleUpdateFolder = (folder: string | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    setShowFolderPicker(false);
    if (blockedOffline()) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await applyMetadataUpdate({ folder: folder ?? undefined });
      toastService.success(
        folder
          ? t('recipes.movedToFolder', { folder })
          : t('recipes.removedFromFolder'),
      );
    }, setUpdatingFolderTags);
  };

  const handleUpdateTags = (tags: string[]): Promise<void> => {
    if (!recipeId) return Promise.resolve();
    if (blockedOffline()) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await applyMetadataUpdate({ tags });
      toastService.success(t('recipes.tagsUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateNotes = (notes: string): Promise<void> => {
    if (!recipeId) return Promise.resolve();
    if (blockedOffline()) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await applyMetadataUpdate({ notes: notes || undefined });
      toastService.success(t('recipes.notesUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateRating = (rating: number | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();
    if (blockedOffline()) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await applyMetadataUpdate({ personalRating: rating });
      toastService.success(
        rating
          ? t('recipes.ratedValue', { rating })
          : t('recipes.ratingRemoved'),
      );
    }, setUpdatingFolderTags);
  };

  const handleUnfavoriteRecipe = (): Promise<void> => {
    // For backend recipes, use recipeId. For external recipes, fall back to
    // the preloadedRecipe id from the preload cache.
    const targetRecipeId = recipeId || preloadedRecipeId;

    if (!targetRecipeId) {
      toastService.error(t('recipes.cannotRemoveNoId'));
      return Promise.resolve();
    }
    if (blockedOffline()) return Promise.resolve();

    return executeWithLoadingState(async () => {
      let result;
      try {
        result = await unfavoriteRecipeMutation({
          variables: { input: { recipeId: targetRecipeId } },
        });
      } catch (error: unknown) {
        errorService.reportError(error, { operation: 'unfavoriteRecipe' });
      }

      if (classifyCreateResult(result) === 'rejected') {
        toastService.error(t('recipes.removeFromSavedFailed'));
        return;
      }

      onUnfavoriteSuccess();
      toastService.success(t('recipes.recipeRemovedFromSaved'));
    }, setUpdatingFolderTags);
  };

  return {
    showFolderPicker,
    setShowFolderPicker,
    updatingFolderTags,
    handleUpdateFolder,
    handleUpdateTags,
    handleUpdateNotes,
    handleUpdateRating,
    handleUnfavoriteRecipe,
    isApiUnavailable,
  };
}
