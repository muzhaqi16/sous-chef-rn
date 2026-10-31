import { useState } from 'react';
import { useTranslation } from '#/i18n';
import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { UpdateFavoriteRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import type { SavedFieldsInputs } from '#features/recipes/offline/localWrites';
import { useUnfavoriteRecipe } from '#features/recipes/hooks/useUnfavoriteRecipe';
import { toastService } from '#/services/toastService';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import {
  UseRecipeSavedMetadata_RecipeFragmentDoc,
  type UseRecipeSavedMetadata_RecipeFragment,
} from './useRecipeSavedMetadata.generated';

interface UseRecipeSavedMetadataOptions {
  recipeId: string | undefined;
}

type SavedDetails = NonNullable<
  UseRecipeSavedMetadata_RecipeFragment['savedDetails']
>;

/** The cached `SavedRecipe` behind a recipe, off `Recipe.savedDetails`. */
function readSavedDetails(
  cache: ApolloCache,
  recipeId: string | undefined,
): SavedDetails | undefined {
  if (!recipeId) return undefined;
  const cacheId = cache.identify({ __typename: 'Recipe', id: recipeId });
  if (!cacheId) return undefined;
  return (
    cache.readFragment({
      id: cacheId,
      fragment: UseRecipeSavedMetadata_RecipeFragmentDoc,
      optimistic: true,
    })?.savedDetails ?? undefined
  );
}

export function useRecipeSavedMetadata({
  recipeId,
}: UseRecipeSavedMetadataOptions) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { unfavoriteRecipe } = useUnfavoriteRecipe();
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [updatingFolderTags, setUpdatingFolderTags] = useState(false);

  const [updateFavoriteRecipeMutation] = useMutation(
    UpdateFavoriteRecipeDocument,
    { context: { localFirst: true } },
  );

  /**
   * One local-first write for all four metadata edits: they differ only in
   * which field they set, and every one is an absolute write on a row keyed by
   * its existing id — so a replay lands the same state twice.
   */
  const applyMetadataUpdate = async (
    updates: Partial<SavedDetails>,
    input: Record<string, unknown>,
  ): Promise<boolean> => {
    // Every caller returns early without a recipe; this keeps the id typed.
    if (!recipeId) return false;
    const inputs: SavedFieldsInputs = {
      savedRecipeId: readSavedDetails(client.cache, recipeId)?.id,
      fields: updates,
    };

    const settled = await pendingWritesOf(client.cache).send(
      UpdateFavoriteRecipeDocument,
      { input: { recipeId, ...input } },
      write =>
        settleMutation(() => updateFavoriteRecipeMutation(write), {
          document: UpdateFavoriteRecipeDocument,
          fallback: t('recipes.updateRecipeFailed'),
          present: 'toast',
        }),
      inputs,
    );
    return settled.status !== 'failed';
  };

  const handleUpdateFolder = (folder: string | null): Promise<void> => {
    if (!recipeId) return Promise.resolve();

    setShowFolderPicker(false);
    return executeWithLoadingState(async () => {
      // `folder` as given, NOT `folder ?? undefined`: serializing drops an
      // undefined value, and an absent key means "leave unchanged", so a
      // cleared folder would snap back.
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
    // A catalog recipe still being opened has no id yet.
    const targetRecipeId = recipeId;

    if (!targetRecipeId) {
      toastService.error(t('recipes.cannotRemoveNoId'));
      return Promise.resolve();
    }

    return executeWithLoadingState(async () => {
      const kept = await unfavoriteRecipe(targetRecipeId, {
        fallback: t('recipes.removeFromSavedFailed'),
        present: 'toast',
      });
      if (!kept) return;

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
