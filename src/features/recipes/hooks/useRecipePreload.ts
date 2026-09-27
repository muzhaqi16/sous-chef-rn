/**
 * An external (Spoonacular) recipe's backend mirror, and the save-to-favorites
 * path over it.
 */

import { useState } from 'react';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AddRecipeToFavoritesDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { generateEntityId } from '#/utils/generateEntityId';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import type { RecipeInformation } from '#/services/spoonacular/types';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import {
  adoptServerFavoriteId,
  writeOptimisticFavorite,
} from '#features/recipes/cache/favorites';
import { toastService } from '#/services/toastService';
import { useTranslation } from '#/i18n';
import { useExternalRecipeMirror } from '#features/recipes/hooks/useExternalRecipeMirror';

export interface UseRecipePreloadOptions {
  onFavoriteSuccess?: () => void;
}

export interface SaveToFavoritesOptions {
  /** Folder to save recipe to */
  folder?: string;
  /** Tags to add to the saved recipe */
  tags?: string[];
  /** User notes about the recipe */
  notes?: string;
}

export function useRecipePreload(options: UseRecipePreloadOptions = {}) {
  const { t } = useTranslation();
  const client = useApolloClient();
  const { onFavoriteSuccess } = options;

  const { preloadedRecipe, preloadRecipe, mirroredRecipeId } =
    useExternalRecipeMirror();
  const [savingToFavorites, setSavingToFavorites] = useState(false);

  // Mutations
  const [favoriteRecipe] = useMutation(AddRecipeToFavoritesDocument, {
    // Use cache.updateQuery instead of refetchQueries for better performance and offline support
    update: (cache, { data }, { variables }) => {
      const payload = appliedPayload(data);
      if (!payload) return;

      const savedRecipe = payload.savedRecipe;

      // Add to MySavedRecipes cache
      cache.updateQuery<MySavedRecipesQuery>(
        { query: MySavedRecipesDocument },
        existing => {
          if (!existing?.me) return existing;

          // Check if already exists (prevent duplicates)
          const exists = existing.me.savedRecipesConnection.edges.some(
            edge => edge.node.id === savedRecipe.id,
          );
          if (exists) return existing;

          return {
            ...existing,
            me: {
              ...existing.me,
              savedRecipesConnection: {
                ...existing.me.savedRecipesConnection,
                edges: [
                  ...existing.me.savedRecipesConnection.edges,
                  {
                    __typename: 'SavedRecipeEdge',
                    cursor: savedRecipe.id,
                    node: savedRecipe,
                  },
                ],
                totalCount:
                  (existing.me.savedRecipesConnection.totalCount ?? 0) + 1,
              },
            },
          };
        },
      );

      // Update SavedRecipeFolders cache if a folder was specified
      const folder = savedRecipe.folder;
      if (folder) {
        cache.updateQuery<SavedRecipeFoldersQuery>(
          { query: SavedRecipeFoldersDocument },
          existing => {
            if (!existing) return existing;

            // Check if folder already exists
            if (existing.savedRecipeFolders.includes(folder)) {
              return existing;
            }

            // Add the new folder to the list
            return {
              ...existing,
              savedRecipeFolders: [...existing.savedRecipeFolders, folder],
            };
          },
        );
      }

      const clientId = variables?.input.id;
      if (clientId && savedRecipe.id !== clientId) {
        adoptServerFavoriteId(
          cache,
          clientId,
          savedRecipe.id,
          savedRecipe.recipeId,
        );
      }
    },
  });
  /**
   * Re-ingests with per-ingredient cost before favoriting, so the deliberate
   * save enriches the mirror, then favorites the resulting backend recipe.
   */
  const saveRecipeToFavorites = async (
    spoonacularRecipe: RecipeInformation,
    saveOptions?: SaveToFavoritesOptions,
  ): Promise<{ success: boolean; recipeId?: string }> => {
    setSavingToFavorites(true);

    const externalId = String(spoonacularRecipe.id);

    // Best-effort online enrichment: re-ingest with per-ingredient cost (withCost
    // fetches the recipe-scoped priceBreakdown and forces a refresh). When the
    // API is unreachable it returns null and we fall back to the recipe already
    // minted by an earlier view-preload — so favoriting an already-cached recipe
    // is decoupled from the online upsert and works offline.
    const preloaded = await preloadRecipe(
      spoonacularRecipe,
      ExternalSource.Spoonacular,
      { withCost: true },
    );
    const recipeId = preloaded?.id ?? mirroredRecipeId(externalId);
    if (!recipeId) {
      // First-ever save AND the upsert couldn't reach the API — nothing minted
      // to favorite.
      setSavingToFavorites(false);
      toastService.error(t('recipes.saveRecipeFailed'));
      return { success: false };
    }

    // Mint the SavedRecipe row's permanent PK client-side (sent as `input.id`),
    // so an online create and a queued offline replay converge on one row — a
    // duplicate-id replay resolves to the existing SavedRecipe as a success
    // payload, which the queue drains as applied (no duplicate row).
    const savedRecipeId = generateEntityId();

    // Write the favorite to the cache BEFORE firing, so the heart fills and the
    // saved list shows it offline and the favorite survives a queued create.
    // `revert()` undoes all three writes on a server rejection.
    const revert = writeOptimisticFavorite(
      client.cache,
      savedRecipeId,
      recipeId,
      saveOptions,
    );

    const favoriteRecipeOptions = {
      variables: {
        input: {
          id: savedRecipeId,
          recipeId,
          folder: saveOptions?.folder,
          tags: saveOptions?.tags,
          notes: saveOptions?.notes,
        },
      },
      // Local-first: queue + replay (idempotent via the client-minted id —
      // a re-favorite resolves to the already-saved row) when the API is
      // unreachable, instead of failing the save.
      context: { localFirst: true },
    };
    // Applied (online) and queued (offline / API down) both keep the optimistic
    // favorite — the heart fills and a queued favorite replays. Only a failure
    // reverts, whether it threw or resolved as a refusal.
    const settled = await settleMutation(
      () => favoriteRecipe(favoriteRecipeOptions),
      {
        document: AddRecipeToFavoritesDocument,
        fallback: t('recipes.saveRecipeFailed'),
        onFailed: revert,
        // Saving a recipe reports its outcome as a toast.
        present: 'none',
      },
    );

    setSavingToFavorites(false);

    if (settled.failure) {
      toastService.error(settled.failure.body);
      return { success: false };
    }

    toastService.success(t('recipes.recipeSavedToCollection'));
    onFavoriteSuccess?.();

    return { success: true, recipeId };
  };

  return {
    preloadedRecipe,
    savingToFavorites,
    preloadRecipe,
    saveRecipeToFavorites,
  };
}

export type UseRecipePreloadReturn = ReturnType<typeof useRecipePreload>;
