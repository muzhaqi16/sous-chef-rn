import { useState } from 'react';
import { useMutation } from '@apollo/client/react';
import {
  UpdateFavoriteRecipeDocument,
  UnfavoriteRecipeDocument,
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
        console.error('Update favorite recipe error:', err);
        toastService.error(err.message || 'Failed to update recipe');
      },
    },
  );

  const [unfavoriteRecipeMutation] = useMutation(UnfavoriteRecipeDocument, {
    update: (cache, { data }, { variables }) => {
      if (
        data?.unfavoriteRecipe?.__typename !== 'UnfavoriteRecipePayload' ||
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
      console.error('Unfavorite recipe error:', err);
      toastService.error(err.message || 'Failed to remove recipe from saved');
    },
  });

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
        folder ? `Moved to "${folder}"` : 'Removed from folder',
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
      toastService.success('Tags updated');
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
      toastService.success('Notes updated');
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
      toastService.success(rating ? `Rated ${rating}/5` : 'Rating removed');
    }, setUpdatingFolderTags);
  };

  const handleUnfavoriteRecipe = (): Promise<void> => {
    // For backend recipes, use recipeId. For external recipes, fall back to
    // the preloadedRecipe id from the preload cache.
    const targetRecipeId = recipeId || preloadedRecipeId;

    if (!targetRecipeId) {
      toastService.error('Cannot remove: recipe ID not found');
      return Promise.resolve();
    }

    return executeWithLoadingState(async () => {
      await unfavoriteRecipeMutation({
        variables: { input: { recipeId: targetRecipeId } },
      });
      onUnfavoriteSuccess();
      toastService.success('Recipe removed from saved');
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
