import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from 'react-i18next';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { type Reference } from '@apollo/client';
import {
  UpdateFavoriteRecipeDocument,
  RemoveRecipeFromFavoritesDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { toastService } from '#/services/toastService';
import {
  executeMutation,
  executeWithLoadingState,
} from '#/utils/compilerSafeWrappers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';

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
  const client = useApolloClient();
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

  // The cache work (drop the MySavedRecipes edge + clear Recipe.savedDetails)
  // runs optimistically BEFORE the mutation fires in handleUnfavoriteRecipe, so
  // the un-save sticks even fully offline (the queue replays the idempotent
  // unfavorite). A rejected result reverts from a snapshot — so no update/onError
  // callback here.
  const [unfavoriteRecipeMutation] = useMutation(
    RemoveRecipeFromFavoritesDocument,
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
      const recipeCacheId = client.cache.identify({
        __typename: 'Recipe',
        id: targetRecipeId,
      });

      // Snapshot for revert, then write the un-save optimistically so it sticks
      // even fully offline (the queued mutation replays later).
      const savedRecipesSnapshot = client.cache.readQuery<MySavedRecipesQuery>({
        query: MySavedRecipesDocument,
      });
      let savedDetailsSnapshot: Reference | null = null;

      client.cache.updateQuery<MySavedRecipesQuery>(
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
                  edge => edge.node.recipe.id !== targetRecipeId,
                ),
                totalCount: Math.max(
                  0,
                  (existing.me.savedRecipesConnection.totalCount ?? 0) - 1,
                ),
              },
            },
          };
        },
      );
      if (recipeCacheId) {
        client.cache.modify<{ savedDetails: Reference | null }>({
          id: recipeCacheId,
          fields: {
            savedDetails(existing) {
              savedDetailsSnapshot = existing;
              return null;
            },
          },
        });
      }

      const revert = () => {
        if (savedRecipesSnapshot) {
          client.cache.writeQuery({
            query: MySavedRecipesDocument,
            data: savedRecipesSnapshot,
          });
        }
        if (recipeCacheId) {
          client.cache.modify<{ savedDetails: Reference | null }>({
            id: recipeCacheId,
            fields: { savedDetails: () => savedDetailsSnapshot },
          });
        }
      };

      const result = await executeMutation(
        () =>
          unfavoriteRecipeMutation({
            variables: { input: { recipeId: targetRecipeId } },
            // Local-first: queue + replay (idempotent) when the API is
            // unreachable instead of surfacing a blocking error.
            context: { localFirst: true },
          }),
        (error: unknown) => {
          revert();
          errorService.reportError(error, { operation: 'unfavoriteRecipe' });
          toastService.error(t('recipes.removeFromSavedFailed'));
        },
      );
      if (!result) return; // threw -> already reverted in the fallback above

      // A resolved rejection (error union member / transport error) reverts;
      // 'queued' (offline / API down) keeps the optimistic removal — it replays.
      if (
        classifyCreateResult(
          result,
          'removeRecipeFromFavorites',
          'RemoveRecipeFromFavoritesPayload',
        ) === 'rejected'
      ) {
        revert();
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
  };
}
