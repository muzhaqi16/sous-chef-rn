import { useState } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { AddRecipeToFavoritesDocument } from '#features/recipes/graphql/recipe.generated';
import type { MaterializedRecipe } from '#features/recipes/hooks/useRecipeData';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { firstNonBlank } from '#/utils/firstNonBlank';
import { generateEntityId } from '#/utils/generateEntityId';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  linkSavedFavorite,
  writeLocalFavorite,
  type SaveToFavoritesOptions,
} from '#features/recipes/cache/favorites';
import { toastService } from '#/services/toastService';
import { useTranslation } from '#/i18n';

export interface UseRecipeFavoriteStateParams {
  backendRecipe: MaterializedRecipe | undefined;
  /** After a save lands, applied or queued. */
  onSaved: () => void;
}

export interface UseRecipeFavoriteStateResult {
  isSaved: boolean;
  saving: boolean;
  handleSaveRecipe: (
    folder?: string | null,
    tags?: string[],
    notes?: string,
  ) => void;
}

/**
 * Whether the recipe is saved, read off `savedDetails`, and the save itself.
 * Every recipe the screen shows is the API's own, catalog ones included.
 */
export function useRecipeFavoriteState({
  backendRecipe,
  onSaved,
}: UseRecipeFavoriteStateParams): UseRecipeFavoriteStateResult {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [saving, setSaving] = useState(false);

  const [favoriteRecipe] = useMutation(AddRecipeToFavoritesDocument, {
    context: { localFirst: true },
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (!payload) return;
      const { savedRecipe } = payload;
      linkSavedFavorite(
        cache,
        {
          id: savedRecipe.id,
          recipeId: savedRecipe.recipeId,
          folder: savedRecipe.folder,
        },
        variables?.input.id,
      );
    },
  });

  const favorite = async (
    recipeId: string,
    saveOptions: SaveToFavoritesOptions,
  ): Promise<void> => {
    // The SavedRecipe's permanent id is minted here, so an online create and a
    // queued replay converge on one row.
    const savedRecipeId = generateEntityId();
    // Written before firing, so the heart fills offline and a queued favorite
    // survives; `revert()` undoes it on a refusal.
    const revert = writeLocalFavorite(
      client.cache,
      savedRecipeId,
      recipeId,
      saveOptions,
    );

    const settled = await settleMutation(
      () =>
        favoriteRecipe({
          variables: {
            input: {
              id: savedRecipeId,
              recipeId,
              folder: saveOptions.folder,
              tags: saveOptions.tags,
              notes: saveOptions.notes,
            },
          },
        }),
      {
        document: AddRecipeToFavoritesDocument,
        fallback: t('recipes.saveRecipeFailed'),
        onFailed: revert,
        // Saving a recipe reports its outcome as a toast.
        present: 'none',
      },
    );

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return;
    }
    toastService.success(t('recipes.recipeSavedToCollection'));
    onSaved();
  };

  const handleSaveRecipe = (
    folder?: string | null,
    tags?: string[],
    notes?: string,
  ) => {
    if (!backendRecipe) return;
    const recipeId = backendRecipe.id;
    const options: SaveToFavoritesOptions = {
      folder: folder ?? undefined,
      tags: tags && tags.length > 0 ? tags : undefined,
      notes: firstNonBlank(notes),
    };
    void executeWithLoadingState(
      () => favorite(recipeId, options),
      setSaving,
      err => errorService.reportError(err, { operation: 'saveRecipe' }),
    );
  };

  return {
    isSaved: !!backendRecipe?.savedDetails,
    saving,
    handleSaveRecipe,
  };
}
