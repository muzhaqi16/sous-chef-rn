/**
 * Hook for preloading recipe data to the backend
 *
 * When a user views an external recipe (from Spoonacular), this hook will:
 * 1. Store the recipe in the backend via upsertExternalRecipe
 * 2. Return the backend recipe ID for subsequent operations
 * 3. Provide a function to save the recipe to user's favorites
 */

import { useState, useRef } from 'react';
import { errorService } from '#/services/errorService';
import { useMutation } from '@apollo/client/react';
import {
  AddRecipeToFavoritesDocument,
  UpsertExternalRecipeDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  RecipeInformation,
  type RecipePriceBreakdown,
} from '#/services/recipeApi/types';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import { executeMutation, executeQuery } from '#/utils/compilerSafeWrappers';
import { toastService } from '#/services/toastService';
import { useTranslation } from 'react-i18next';
import { optimisticDataPersistence } from '#/apollo/offline/OptimisticDataPersistence';
import { stripPriceFromName } from '#/utils/stripPriceFromName';

/** Normalize an ingredient name for the fuzzy priceBreakdown join. */
const normalizeName = (name: string): string => name.trim().toLowerCase();

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
    update: (cache, { data }) => {
      if (data?.addRecipeToFavorites?.__typename !== 'FavoriteRecipePayload')
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

      // Persist optimistic favorite state to survive cache-and-network refetches while offline
      optimisticDataPersistence.save(
        'SavedRecipe',
        savedRecipe.recipe.id,
        'isFavorited',
        true,
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
    },
  });
  const [upsertRecipe] = useMutation(UpsertExternalRecipeDocument);

  /**
   * Transform Spoonacular recipe data to CreateRecipeInput format
   */
  const transformToRecipeInput = (
    spoonacularRecipe: RecipeInformation,
    priceBreakdown?: RecipePriceBreakdown | null,
  ) => {
    // Extract calories from nutrition data
    const caloriesPerServing = spoonacularRecipe.nutrition?.nutrients?.find(
      n => n.name === 'Calories',
    )?.amount;

    // Transform instructions to JSON format (matches user-created format: { step, text })
    const instructions =
      spoonacularRecipe.analyzedInstructions?.[0]?.steps?.map(step => ({
        step: step.number,
        text: step.step,
      })) || [];

    // Per-ingredient nutrition is already present in the recipe response when
    // it's fetched with `includeNutrition: true` (see useRecipeData) — index it
    // by Spoonacular ingredient id so the mirror can carry it with ZERO extra
    // Spoonacular calls. The rich /food/ingredients/{id}/information endpoint
    // (cost/possibleUnits/categoryPath) is intentionally not called — N calls
    // per recipe would blow the API quota; the server owns those fields.
    const nutritionByIngredientId = new Map(
      (spoonacularRecipe.nutrition?.ingredients ?? []).map(
        (n): [number, typeof n] => [n.id, n],
      ),
    );

    // Per-ingredient estimated cost (US cents) from the recipe-scoped
    // priceBreakdown — only present on deliberate saves. priceBreakdown
    // identifies ingredients by NAME (no id), so match on normalized name only.
    // An unmatched ingredient simply gets no cost — never a guessed/positional
    // one, which could assign the wrong ingredient's price.
    const costByName = new Map(
      (priceBreakdown?.ingredients ?? []).map((c): [string, number] => [
        normalizeName(c.name),
        c.price,
      ]),
    );

    return {
      // Basic recipe info
      name: spoonacularRecipe.title,
      description: spoonacularRecipe.summary?.replace(/<[^>]*>/g, ''),
      servings: spoonacularRecipe.servings,
      prepTimeMinutes: spoonacularRecipe.preparationMinutes || undefined,
      cookTimeMinutes: spoonacularRecipe.cookingMinutes || undefined,
      // Spoonacular usually omits the prep/cook breakdown but always provides
      // readyInMinutes — persist it as the total time so the imported recipe
      // carries a time of its own (otherwise it shows servings only).
      timing: spoonacularRecipe.readyInMinutes
        ? { totalTimeMinutes: spoonacularRecipe.readyInMinutes }
        : undefined,
      imageUrl: spoonacularRecipe.image,
      instructions,
      caloriesPerServing: caloriesPerServing
        ? Math.round(caloriesPerServing)
        : undefined,
      cuisine: spoonacularRecipe.cuisines?.join(', '),

      // Attribution - original recipe source
      attribution: {
        source: spoonacularRecipe.sourceName,
        sourceUrl: spoonacularRecipe.sourceUrl,
      },

      // External source fields
      source: ExternalSource.Spoonacular,
      externalSourceId: String(spoonacularRecipe.id),
      externalSourceUrl: spoonacularRecipe.sourceUrl,
      externalSourceData: spoonacularRecipe,

      // Transform ingredients for backend
      ingredients:
        spoonacularRecipe.extendedIngredients?.map((ing, idx) => {
          const ingredientNutrition = nutritionByIngredientId.get(ing.id);
          const costCents = costByName.get(normalizeName(ing.name));
          return {
            // Sanitize at the API boundary — the API stores names verbatim, so a
            // price must never ride in on the name (it belongs in estimatedPrice).
            name: stripPriceFromName(ing.name),
            quantity: ing.amount || 0,
            originalString: ing.original,
            sortOrder: idx,
            // Typed, loss-free Spoonacular mirror — replaces the deprecated flat
            // spoonacular* fields. The server caches this payload verbatim,
            // extracts nutrition/cost/units/image/aisle into the catalog, and
            // links the ingredient to an Item asynchronously (fill-if-null).
            // See sous-chef-api docs/architecture/external-ingredient-mirror.md.
            externalSources: [
              {
                source: ExternalSource.Spoonacular,
                externalId: String(ing.id),
                isPrimary: true,
                spoonacular: {
                  id: ing.id,
                  // Verbatim upstream name — the mirror is loss-free; only the
                  // top-level canonical `name` above is price-stripped.
                  name: ing.name,
                  nameClean: ing.nameClean,
                  original: ing.original,
                  originalName: ing.originalName,
                  amount: ing.amount,
                  unit: ing.unit,
                  unitShort: ing.measures?.us?.unitShort,
                  unitLong: ing.measures?.us?.unitLong,
                  consistency: ing.consistency,
                  aisle: ing.aisle,
                  // Filename only — the server builds the CDN URL and
                  // internalizes the image to our storage so it renders offline.
                  image: ing.image,
                  meta: ing.meta,
                  measures: {
                    us: {
                      amount: ing.measures?.us?.amount,
                      unitShort: ing.measures?.us?.unitShort,
                      unitLong: ing.measures?.us?.unitLong,
                    },
                    metric: {
                      amount: ing.measures?.metric?.amount,
                      unitShort: ing.measures?.metric?.unitShort,
                      unitLong: ing.measures?.metric?.unitLong,
                    },
                  },
                  // Only `nutrients` is per-ingredient; properties/flavonoids/
                  // caloricBreakdown/weightPerServing are recipe-level and stay
                  // omitted. Absent when the recipe wasn't fetched with
                  // nutrition or the ingredient has no match.
                  nutrition: ingredientNutrition
                    ? {
                        nutrients: ingredientNutrition.nutrients.map(n => ({
                          name: n.name,
                          amount: n.amount,
                          unit: n.unit,
                          percentOfDailyNeeds: n.percentOfDailyNeeds,
                        })),
                      }
                    : undefined,
                  // Estimated cost (US cents) — the server stores it as the
                  // estimate on the catalog item's price history. Absent unless
                  // priceBreakdown was fetched (deliberate saves only).
                  estimatedCost:
                    costCents != null
                      ? { value: costCents, unit: 'US Cents' }
                      : undefined,
                },
              },
            ],
          };
        }) || [],
    };
  };

  /**
   * Preload a recipe to the backend (fire-and-forget)
   *
   * This should be called when a user views an external recipe.
   * The recipe will be stored in the backend (find-or-create pattern).
   * This is fire-and-forget - it only attempts once per recipe.
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
    // call), fetched only on deliberate saves. Best-effort — a failure leaves
    // estimatedCost empty rather than blocking the save.
    // Best-effort: a failure (network/quota) returns null so the save proceeds
    // without cost rather than blocking on it.
    const priceBreakdown = preloadOptions.withCost
      ? await executeQuery(
          () => spoonacularService.getRecipePriceBreakdown(Number(externalId)),
          'preloadRecipe: fetch price breakdown',
        )
      : null;

    const input = transformToRecipeInput(spoonacularRecipe, priceBreakdown);

    const result = await executeMutation(
      () => upsertRecipe({ variables: { input } }),
      error => {
        errorService.reportError(error, { operation: 'preloadRecipe' });
        if (preloadOptions.throwOnError) {
          setPreloading(false);
          throw error; // Propagate error for explicit saves
        }
      },
    );

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
   * Save a recipe to the user's favorites.
   *
   * Re-ingests the recipe with per-ingredient cost (withCost) before favoriting
   * so the deliberate-save path enriches the mirror, then favorites the
   * resulting backend recipe.
   */
  const saveRecipeToFavorites = async (
    spoonacularRecipe: RecipeInformation,
    saveOptions?: SaveToFavoritesOptions,
  ): Promise<{ success: boolean; recipeId?: string }> => {
    setSavingToFavorites(true);

    // Deliberate save → re-ingest with per-ingredient cost (withCost fetches
    // the recipe-scoped priceBreakdown and forces a refresh even if the view
    // already preloaded this recipe without cost).
    const preloaded = await preloadRecipe(
      spoonacularRecipe,
      ExternalSource.Spoonacular,
      { throwOnError: true, withCost: true },
    );
    if (!preloaded) {
      setSavingToFavorites(false);
      toastService.error(t('recipes.saveRecipeFailed'));
      return { success: false };
    }

    const recipeId = preloaded.id;

    const result = await executeMutation(
      () =>
        favoriteRecipe({
          variables: {
            input: {
              recipeId,
              folder: saveOptions?.folder,
              tags: saveOptions?.tags,
              notes: saveOptions?.notes,
            },
          },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'saveRecipeToFavorites',
        });
        toastService.error(t('recipes.saveRecipeFailed'));

        if (error instanceof Error) {
          onFavoriteError?.(error);
        }
      },
    );

    setSavingToFavorites(false);

    if (!result) return { success: false };

    // Under errorPolicy 'all' a refusal RESOLVES as an error union member
    // (ConflictError / ValidationError / …) instead of throwing — without this
    // check a refused favorite would toast success. Nothing to clear: the
    // mutation's update callback only persists on the success payload.
    if (
      result.error ||
      result.data?.addRecipeToFavorites?.__typename !== 'FavoriteRecipePayload'
    ) {
      toastService.error(t('recipes.saveRecipeFailed'));
      return { success: false };
    }

    // Clear persisted optimistic favorite state on server confirmation
    optimisticDataPersistence.clear('SavedRecipe', recipeId, 'isFavorited');

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
