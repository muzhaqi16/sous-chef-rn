/**
 * Mirrors an external (Spoonacular) recipe into the backend via
 * `upsertExternalRecipe`, returning its backend id for later operations, and
 * exposes the save-to-favorites path over it.
 */

import { useState, useRef } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  AddRecipeToFavoritesDocument,
  UpsertExternalRecipeDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { generateEntityId } from '#/utils/generateEntityId';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import { RecipeInformation } from '#/services/spoonacular/types';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  adoptServerFavoriteId,
  writeOptimisticFavorite,
} from '#features/recipes/cache/favorites';
import { toastService } from '#/services/toastService';
import { useTranslation } from '#/i18n';
import { toRecipeInput } from '#features/recipes/utils/toRecipeInput';

/**
 * Represents a recipe that has been preloaded to the backend
 */
export interface PreloadedRecipe {
  /** Backend recipe ID */
  id: string;
  /** Recipe name */
  name: string;
  /** Recipe image URL */
  imageUrl?: string;
  /** Whether this was a newly created recipe (vs found existing) */
  created: boolean;
  /** External source */
  externalSource: ExternalSource;
  /** External ID (Spoonacular ID) */
  externalId: string;
}

export interface UseRecipePreloadOptions {
  /** Callback when preload succeeds */
  onPreloadSuccess?: (recipe: PreloadedRecipe) => void;
  /** Callback when preload fails */
  onPreloadError?: (error: Error) => void;
  /** Callback when favorite succeeds */
  onFavoriteSuccess?: () => void;
  /** Callback when favorite fails */
  onFavoriteError?: (error: Error) => void;
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
  const { onPreloadSuccess, onFavoriteSuccess, onFavoriteError } = options;

  // State
  const [preloading, setPreloading] = useState(false);
  const [preloadedRecipe, setPreloadedRecipe] =
    useState<PreloadedRecipe | null>(null);
  const [preloadError, setPreloadError] = useState<string | null>(null);
  const [savingToFavorites, setSavingToFavorites] = useState(false);

  // Cache of preloaded recipes (externalId -> PreloadedRecipe)
  const preloadCacheRef = useRef<Map<string, PreloadedRecipe>>(new Map());

  // Track which recipes we've already attempted to preload (to prevent multiple calls)
  const attemptedPreloadsRef = useRef<Set<string>>(new Set());

  // Mutations
  const [favoriteRecipe] = useMutation(AddRecipeToFavoritesDocument, {
    // Use cache.updateQuery instead of refetchQueries for better performance and offline support
    update: (cache, { data }, { variables }) => {
      if (
        data?.addRecipeToFavorites?.__typename !== 'AddRecipeToFavoritesPayload'
      )
        return;

      const savedRecipe = data.addRecipeToFavorites.savedRecipe;

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

      const clientId = variables?.input?.id;
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
  const [upsertRecipe] = useMutation(UpsertExternalRecipeDocument);

  /**
   * Transform Spoonacular recipe data to CreateRecipeInput format
   */
  const preloadRecipe = async (
    spoonacularRecipe: RecipeInformation,
    externalSource: ExternalSource = ExternalSource.Spoonacular,
    preloadOptions: { throwOnError?: boolean; withCost?: boolean } = {},
  ): Promise<PreloadedRecipe | null> => {
    const externalId = String(spoonacularRecipe.id);

    // Fire-and-forget view preloads run once per recipe. A deliberate save
    // (withCost) re-ingests to attach per-ingredient cost even if the view
    // already preloaded without it — the server re-ingest is idempotent and
    // TTL-gated, so this is safe to call again.
    if (
      attemptedPreloadsRef.current.has(externalId) &&
      !preloadOptions.withCost
    ) {
      const cached = preloadCacheRef.current.get(externalId);
      return cached || null;
    }
    attemptedPreloadsRef.current.add(externalId);

    setPreloading(true);

    // Per-ingredient cost comes from the recipe-scoped priceBreakdown (ONE
    // call), fetched only on deliberate saves. Best-effort — a failure
    // (network/quota) leaves estimatedCost empty rather than blocking the save.
    let priceBreakdown = null;
    if (preloadOptions.withCost) {
      try {
        priceBreakdown = await spoonacularService.getRecipePriceBreakdown(
          Number(externalId),
        );
      } catch (error) {
        // Best-effort: leaving it null lets the save proceed without cost.
        errorService.reportError(error, {
          operation: 'preloadRecipe: fetch price breakdown',
        });
      }
    }

    const input = toRecipeInput(spoonacularRecipe, priceBreakdown);

    let result;
    try {
      result = await upsertRecipe({ variables: { input } });
    } catch (error) {
      errorService.reportError(error, { operation: 'preloadRecipe' });
      if (preloadOptions.throwOnError) {
        setPreloading(false);
        throw error; // Propagate error for explicit saves
      }
    }

    setPreloading(false);

    if (!result) return null;

    const payload = result.data?.upsertExternalRecipe;
    if (payload?.__typename === 'UpsertExternalRecipePayload') {
      const data = payload;
      const preloaded: PreloadedRecipe = {
        id: data.recipe.id,
        name: data.recipe.name,
        imageUrl: data.recipe.imageUrl ?? undefined,
        created: data.created,
        externalSource,
        externalId,
      };

      preloadCacheRef.current.set(externalId, preloaded);
      setPreloadedRecipe(preloaded);
      onPreloadSuccess?.(preloaded);

      return preloaded;
    }

    return null;
  };

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
      { throwOnError: false, withCost: true },
    );
    const recipeId =
      preloaded?.id ?? preloadCacheRef.current.get(externalId)?.id;
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

    let result;
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
    try {
      result = await favoriteRecipe(favoriteRecipeOptions);
    } catch (error) {
      revert();
      errorService.reportError(error, {
        operation: 'saveRecipeToFavorites',
      });
      toastService.error(t('recipes.saveRecipeFailed'));

      if (error instanceof Error) {
        onFavoriteError?.(error);
      }
    }

    setSavingToFavorites(false);

    if (!result) return { success: false }; // threw -> already reverted above

    // 'created' (online) and 'queued' (offline / API down) both keep the
    // optimistic favorite — the heart fills and a queued favorite replays. Only
    // a resolved rejection (error union member / transport error) reverts. Under
    // errorPolicy:'all' a refusal RESOLVES rather than throws, so this check is
    // what stops a refused favorite from sticking + toasting success.
    const outcome = classifyCreateResult(result);
    if (outcome === 'rejected') {
      revert();
      toastService.error(t('recipes.saveRecipeFailed'));
      return { success: false };
    }

    toastService.success(t('recipes.recipeSavedToCollection'));
    onFavoriteSuccess?.();

    return { success: true, recipeId };
  };

  /**
   * Clear the preload cache
   */
  const clearCache = () => {
    preloadCacheRef.current.clear();
    setPreloadedRecipe(null);
    setPreloadError(null);
  };

  return {
    // State
    preloading,
    preloadedRecipe,
    preloadError,
    savingToFavorites,

    // Actions
    preloadRecipe,
    saveRecipeToFavorites,

    // Helpers
    clearCache,
  };
}

export type UseRecipePreloadReturn = ReturnType<typeof useRecipePreload>;
