import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from 'react-i18next';
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
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

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
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [updatingFolderTags, setUpdatingFolderTags] = useState(false);

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
        toastService.error(err.message || t('recipes.updateRecipeMetaFailed'));
      },
    },
  );

  const [unfavoriteRecipeMutation] = useMutation(
    RemoveRecipeFromFavoritesDocument,
    {
      update: (cache, { data }, { variables }) => {
        if (
          data?.removeRecipeFromFavorites?.__typename !==
            'UnfavoriteRecipePayload' ||
          !variables?.input?.recipeId
        ) {
          return;
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
                  edges: existing.me.savedRecipesConnection.edges.filter(
                    edge => edge.node.recipe.id !== variables.input.recipeId,
                  ),
                  totalCount:
                    (existing.me.savedRecipesConnection.totalCount ?? 0) - 1,
                },
              },
            };
          },
        );

        cache.modify({
          id: cache.identify({
            __typename: 'Recipe',
            id: variables.input.recipeId,
          }),
          fields: {
            savedDetails() {
              return null;
            },
          },
        });
      },
      onError: err => {
        errorService.reportError(err, { operation: 'unfavoriteRecipe' });
        toastService.error(err.message || t('recipes.removeFromSavedFailed'));
      },
    },
  );

  const handleUpdateFolder = (folder: string | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    setShowFolderPicker(false);
    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          input: {
            recipeId,
            folder: folder ?? undefined,
          },
        },
      });
      toastService.success(
        folder
          ? t('recipes.movedToFolder', { folder })
          : t('recipes.removedFromFolder'),
      );
    }, setUpdatingFolderTags);
  };

  const handleUpdateTags = (tags: string[]): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          input: {
            recipeId,
            tags,
          },
        },
      });
      toastService.success(t('recipes.tagsUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateNotes = (notes: string): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          input: {
            recipeId,
            notes: notes || undefined,
          },
        },
      });
      toastService.success(t('recipes.notesUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateRating = (rating: number | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await updateFavoriteRecipeMutation({
        variables: {
          input: {
            recipeId,
            personalRating: rating,
          },
        },
      });
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

    return executeWithLoadingState(async () => {
      await unfavoriteRecipeMutation({
        variables: { input: { recipeId: targetRecipeId } },
      });
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
  };
}
