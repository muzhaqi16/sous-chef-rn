import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import { updateEntityFieldsLocalFirst } from '#/apollo/utils/localFirstFields';
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
import { performOptimisticUnfavorite } from '#features/recipes/utils/optimisticUnfavorite';

interface UseRecipeSavedMetadataOptions {
  recipeId: string | undefined;
  /** Falls back to this id when the recipe was saved as an external recipe (no recipeId yet). */
  preloadedRecipeId: string | undefined;
  /** Called after a successful unfavorite so external-recipe state can be cleared by the caller. */
  onUnfavoriteSuccess: () => void;
}

/**
 * The cached `SavedRecipe` behind a recipe, read off `Recipe.savedDetails`
 * (which every detail query already selects). Needed because the metadata
 * mutations key on `recipeId`, but the row those edits land on is the
 * SavedRecipe — without its id the change cannot be written to the cache, and
 * an offline edit would toast success with nothing visibly changed.
 */
const SavedDetailsRefFragment = gql`
  fragment _SavedDetailsRef on Recipe {
    id
    savedDetails {
      id
      folder
      tags
      notes
      personalRating
    }
  }
`;

interface SavedDetailsRef {
  id: string;
  folder: string | null;
  tags: string[] | null;
  notes: string | null;
  personalRating: number | null;
}

function readSavedDetails(
  cache: ApolloCache,
  recipeId: string | undefined,
): SavedDetailsRef | undefined {
  if (!recipeId) return undefined;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return undefined;
  return (
    cache.readFragment<{ savedDetails: SavedDetailsRef | null }>({
      id: cacheId,
      fragment: SavedDetailsRefFragment,
      fragmentName: '_SavedDetailsRef',
    })?.savedDetails ?? undefined
  );
}

export function useRecipeSavedMetadata({
  recipeId,
  preloadedRecipeId,
  onUnfavoriteSuccess,
}: UseRecipeSavedMetadataOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();

  /**
   * One local-first write for all four metadata edits: they differ only in
   * which field they set, and every one is an absolute write on a row keyed by
   * its existing id — so a replay lands the same state twice.
   */
  const applyMetadataUpdate = async (
    updates: Partial<SavedDetailsRef>,
    input: Record<string, unknown>,
  ): Promise<void> => {
    const saved = readSavedDetails(client.cache, recipeId);
    const previous = Object.fromEntries(
      Object.keys(updates).map(key => [
        key,
        saved?.[key as keyof SavedDetailsRef],
      ]),
    );

    await updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: saved ? { __typename: 'SavedRecipe', id: saved.id } : undefined,
      updates,
      previous,
      logLabel: 'updateFavoriteRecipe',
      mutate: () =>
        updateFavoriteRecipeMutation({
          variables: { input: { recipeId: recipeId!, ...input } },
          context: { localFirst: true },
        }),
    });
  };
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
        toastService.error(err.message || t('labels.failedToUpdateRecipe'));
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
      await applyMetadataUpdate({ folder }, { folder: folder ?? undefined });
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
      await applyMetadataUpdate({ tags }, { tags });
      toastService.success(t('recipes.tagsUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateNotes = (notes: string): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await applyMetadataUpdate({ notes }, { notes: notes || undefined });
      toastService.success(t('recipes.notesUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateRating = (rating: number | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      await applyMetadataUpdate(
        { personalRating: rating },
        { personalRating: rating },
      );
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
      const kept = await performOptimisticUnfavorite({
        client,
        recipeId: targetRecipeId,
        mutate: () =>
          unfavoriteRecipeMutation({
            variables: { input: { recipeId: targetRecipeId } },
            // Local-first: queue + replay (idempotent) when the API is
            // unreachable instead of surfacing a blocking error.
            context: { localFirst: true },
          }),
        operation: 'unfavoriteRecipe',
        reportFailure: () =>
          toastService.error(t('recipes.removeFromSavedFailed')),
      });
      if (!kept) return;

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
