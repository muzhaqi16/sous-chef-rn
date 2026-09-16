import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';
import { settleMutation } from '#/apollo/utils/settleMutation';
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
import { appliedPayload } from '#/utils/errors/mutationPayload';

interface UseRecipeSavedMetadataOptions {
  recipeId: string | undefined;
  /** Falls back to this id when the recipe was saved as an external recipe (no recipeId yet). */
  preloadedRecipeId: string | undefined;
  /** Called after a successful unfavorite so external-recipe state can be cleared by the caller. */
  onUnfavoriteSuccess: () => void;
}

/**
 * The cached `SavedRecipe` behind a recipe, off `Recipe.savedDetails`. The
 * metadata mutations key on `recipeId` but the edits land on the SavedRecipe,
 * so without its id an offline edit toasts success and changes nothing.
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
  ): Promise<boolean> => {
    // Every caller returns early without a recipe; this keeps the id typed.
    if (!recipeId) return false;
    const saved = readSavedDetails(client.cache, recipeId);
    const entity = saved
      ? { __typename: 'SavedRecipe', id: saved.id }
      : undefined;
    const previous = snapshotFields(saved, updates);
    writeEntityFields(client.cache, entity, updates);

    // A queued write keeps its cache change and counts as persisted.
    const settled = await settleMutation(
      () =>
        updateFavoriteRecipeMutation({
          variables: { input: { recipeId, ...input } },
          context: { localFirst: true },
        }),
      {
        document: UpdateFavoriteRecipeDocument,
        fallback: t('recipes.updateRecipeFailed'),
        onFailed: () => writeEntityFields(client.cache, entity, previous),
        present: 'none',
      },
    );
    if (settled.failure) toastService.error(settled.failure.body);
    return settled.status !== 'failed';
  };
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [updatingFolderTags, setUpdatingFolderTags] = useState(false);

  const [updateFavoriteRecipeMutation] = useMutation(
    UpdateFavoriteRecipeDocument,
    {
      update: (cache, { data }) => {
        const payload = appliedPayload(data);
        if (!payload) return;
        const updatedSavedRecipe = payload.savedRecipe;

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
      // `folder` explicitly, NOT `folder ?? undefined`: an undefined value is
      // dropped when the variables are serialized, and an absent key means
      // "leave unchanged" to the server. Clearing a folder wrote null into the
      // cache, sent nothing, and the mutation's own `update` then wrote the
      // server's unchanged folder back over the row — so it snapped back
      // seconds later under a success toast, and offline never converged.
      const persisted = await applyMetadataUpdate({ folder }, { folder });
      if (!persisted) return;
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
      const persisted = await applyMetadataUpdate({ tags }, { tags });
      if (!persisted) return;
      toastService.success(t('recipes.tagsUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateNotes = (notes: string): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      // Same as the folder above: emptied notes must travel as an explicit
      // value, or the server keeps the old text.
      const persisted = await applyMetadataUpdate(
        { notes },
        { notes: notes || null },
      );
      if (!persisted) return;
      toastService.success(t('recipes.notesUpdated'));
    }, setUpdatingFolderTags);
  };

  const handleUpdateRating = (rating: number | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    return executeWithLoadingState(async () => {
      const persisted = await applyMetadataUpdate(
        { personalRating: rating },
        { personalRating: rating },
      );
      if (!persisted) return;
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
    const targetRecipeId = recipeId ?? preloadedRecipeId;

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
        fallback: t('recipes.removeFromSavedFailed'),
        present: failure => toastService.error(failure.body),
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
