/**
 * Mirrors an external (Spoonacular) recipe into the backend via
 * `upsertExternalRecipe`, returning its backend id for later operations, and
 * exposes the save-to-favorites path over it.
 */

import { useState, useRef } from 'react';
import { errorService } from '#/services/errorService';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql, type Reference } from '@apollo/client';
import {
  AddRecipeToFavoritesDocument,
  UpsertExternalRecipeDocument,
  MySavedRecipesDocument,
  SavedRecipeFoldersDocument,
  type MySavedRecipesQuery,
  type SavedRecipeFoldersQuery,
} from '#features/recipes/graphql/recipe.generated';
import type { SavedRecipeCard_SavedRecipeFragment } from '#features/recipes/components/SavedRecipeCard.generated';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  ExternalSource,
  type CreateRecipeInput,
} from '#/graphql/generated/schemaTypes';
import {
  RecipeInformation,
  type RecipePriceBreakdown,
} from '#/services/recipeApi/types';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { adoptServerEntityId } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import { useTranslation } from '#/i18n';
import { stripPriceFromName } from '#/utils/stripPriceFromName';

/** Normalize an ingredient name for the fuzzy priceBreakdown join. */
const normalizeName = (name: string): string => name.trim().toLowerCase();

/**
 * Entity write shape for the optimistic `SavedRecipe` minted by a local-first
 * favorite. Selects exactly the fields the optimistic write supplies — the
 * rest of the recipe display resolves through the already-cached `Recipe`
 * entity via the `recipe { id }` reference.
 */
const OptimisticSavedRecipeFragment = gql`
  fragment _OptimisticSavedRecipe on SavedRecipe {
    id
    folder
    tags
    notes
    personalRating
    cookedCount
    lastCookedAt
    createdAt
    updatedAt
    recipe {
      id
    }
  }
`;

/** Shape written by {@link OptimisticSavedRecipeFragment}. */
type OptimisticSavedRecipe = {
  __typename: 'SavedRecipe';
  id: string;
  folder: string | null;
  tags: string[];
  notes: string | null;
  personalRating: number | null;
  cookedCount: number;
  lastCookedAt: string | null;
  createdAt: string;
  updatedAt: string;
  recipe: { __typename: 'Recipe'; id: string };
};

/**
 * Recipe display fields the saved-list card renders (the
 * `SavedRecipeCard_savedRecipe → recipe` selection). Read from the already-cached
 * `Recipe` entity so the optimistic `MySavedRecipes` edge node is complete and
 * the card doesn't blank offline.
 */
const SavedRecipeCardRecipeFragment = gql`
  fragment _SavedRecipeCardRecipe on Recipe {
    id
    name
    description
    imageUrl
    servings
    prepTimeMinutes
    cookTimeMinutes
    totalTimeMinutes
  }
`;

/**
 * Writes / reads `Recipe.savedDetails` for the optimistic favorite (and its
 * revert snapshot). writeFragment is used instead of cache.modify because a
 * freshly-upserted Recipe has no `savedDetails` field yet, and cache.modify
 * only fires a modifier for a field that already exists on the entity.
 */
const RecipeSavedDetailsFragment = gql`
  fragment _RecipeSavedDetails on Recipe {
    id
    savedDetails {
      id
    }
  }
`;

/** The `recipe` node the saved-list card renders. */
type SavedRecipeCardRecipe = SavedRecipeCard_SavedRecipeFragment['recipe'];

/**
 * The `MySavedRecipes` edge node — Apollo's `updateQuery` deep-resolves
 * fragments, so this is the UNMASKED `SavedRecipe`: the query's inline
 * `createdAt`/`updatedAt` plus every `SavedRecipeCard_savedRecipe` field.
 */
type SavedRecipeEdgeNode = Omit<
  SavedRecipeCard_SavedRecipeFragment,
  ' $fragmentName'
> & { createdAt: string; updatedAt: string };

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

      // Reconciles a divergent server id: if the recipe was already favorited
      // elsewhere the server resolves to an EXISTING SavedRecipe. Re-point
      // `Recipe.savedDetails` (the response omits it) and evict the client-id
      // entity, whose dangling edge drops via the self-healing read. Must run
      // after the server edge roots that row, or gc collects it.
      const clientId = variables?.input?.id;
      if (clientId && savedRecipe.id !== clientId) {
        const recipeCacheId = cache.identify({
          __typename: 'Recipe',
          id: savedRecipe.recipeId,
        });
        if (recipeCacheId) {
          cache.writeFragment({
            id: recipeCacheId,
            fragment: RecipeSavedDetailsFragment,
            fragmentName: '_RecipeSavedDetails',
            data: {
              __typename: 'Recipe',
              id: savedRecipe.recipeId,
              savedDetails: { __typename: 'SavedRecipe', id: savedRecipe.id },
            },
          });
        }
        adoptServerEntityId(cache, 'SavedRecipe', savedRecipe.id, clientId);
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
      instructions,

      // Structured attributes — the API rejects flat servings/cuisine/time/
      // nutrition/image fields; each lives under its typed sub-input.
      metadata: {
        servings: spoonacularRecipe.servings,
        cuisine: spoonacularRecipe.cuisines?.length
          ? spoonacularRecipe.cuisines.join(', ')
          : undefined,
      },
      // Spoonacular usually omits the prep/cook breakdown but always provides
      // readyInMinutes — persist it as the total time so the imported recipe
      // carries a time of its own (otherwise it shows servings only).
      timing: {
        prepTimeMinutes: spoonacularRecipe.preparationMinutes || undefined,
        cookTimeMinutes: spoonacularRecipe.cookingMinutes || undefined,
        totalTimeMinutes: spoonacularRecipe.readyInMinutes || undefined,
      },
      nutrition: {
        caloriesPerServing: caloriesPerServing
          ? Math.round(caloriesPerServing)
          : undefined,
      },
      media: { imageUrl: spoonacularRecipe.image },

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
    } satisfies CreateRecipeInput;
  };

  /**
   * Fire-and-forget find-or-create when the user views an external recipe.
   * Attempts once per recipe.
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

    const input = transformToRecipeInput(spoonacularRecipe, priceBreakdown);

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
   * Writes the optimistic favorite and returns its undo. Three writes reverted
   * together: the `SavedRecipe` entity under the client-minted id,
   * `Recipe.savedDetails` pointed at it (the heart), and its `MySavedRecipes`
   * edge (the saved list).
   */
  const writeOptimisticFavorite = (
    savedRecipeId: string,
    recipeId: string,
    saveOptions: SaveToFavoritesOptions | undefined,
  ): (() => void) => {
    const now = new Date().toISOString();
    const optimisticSavedRecipe: OptimisticSavedRecipe = {
      __typename: 'SavedRecipe',
      id: savedRecipeId,
      folder: saveOptions?.folder ?? null,
      tags: saveOptions?.tags ?? [],
      notes: saveOptions?.notes ?? null,
      personalRating: null,
      cookedCount: 0,
      lastCookedAt: null,
      createdAt: now,
      updatedAt: now,
      recipe: { __typename: 'Recipe', id: recipeId },
    };

    // (a) Write the full entity so the (bare-ref) edge and savedDetails resolve
    //     even fully offline, where no response ever arrives to materialize it.
    client.cache.writeFragment({
      id: client.cache.identify(optimisticSavedRecipe),
      fragment: OptimisticSavedRecipeFragment,
      fragmentName: '_OptimisticSavedRecipe',
      data: optimisticSavedRecipe,
    });

    // (b) Point Recipe.savedDetails at the new SavedRecipe (snapshot the
    //     previous ref for revert). Use writeFragment, not cache.modify — a
    //     freshly-upserted Recipe has no `savedDetails` field yet, and
    //     cache.modify only fires a modifier for a field that already exists.
    const recipeCacheId = client.cache.identify({
      __typename: 'Recipe',
      id: recipeId,
    });
    const savedDetailsSnapshot = recipeCacheId
      ? client.cache.readFragment<{ savedDetails: Reference | null }>({
          id: recipeCacheId,
          fragment: RecipeSavedDetailsFragment,
          fragmentName: '_RecipeSavedDetails',
        })?.savedDetails ?? null
      : null;
    if (recipeCacheId) {
      client.cache.writeFragment({
        id: recipeCacheId,
        fragment: RecipeSavedDetailsFragment,
        fragmentName: '_RecipeSavedDetails',
        data: {
          __typename: 'Recipe',
          id: recipeId,
          savedDetails: { __typename: 'SavedRecipe', id: savedRecipeId },
        },
      });
    }

    // (c) Add a MySavedRecipes edge (snapshot the query first for revert).
    //     Read the recipe display fields from the already-cached Recipe so the
    //     saved-list card renders complete offline. Fall back to an id-only
    //     recipe when the Recipe entity isn't cached yet — the post-replay
    //     refetch heals the gap.
    const cachedRecipe = recipeCacheId
      ? client.cache.readFragment<SavedRecipeCardRecipe>({
          id: recipeCacheId,
          fragment: SavedRecipeCardRecipeFragment,
          fragmentName: '_SavedRecipeCardRecipe',
        })
      : null;
    const edgeRecipe: SavedRecipeCardRecipe = cachedRecipe ?? {
      __typename: 'Recipe',
      id: recipeId,
      name: '',
      description: null,
      imageUrl: null,
      servings: 0,
      prepTimeMinutes: null,
      cookTimeMinutes: null,
      totalTimeMinutes: null,
    };

    const savedRecipesSnapshot = client.cache.readQuery<MySavedRecipesQuery>({
      query: MySavedRecipesDocument,
    });
    client.cache.updateQuery<MySavedRecipesQuery>(
      { query: MySavedRecipesDocument },
      existing => {
        if (!existing?.me) return existing;
        // Guard against a duplicate edge for the same SavedRecipe id.
        const alreadyEdged = existing.me.savedRecipesConnection.edges.some(
          edge => edge.node.id === savedRecipeId,
        );
        if (alreadyEdged) return existing;
        const node: SavedRecipeEdgeNode = {
          __typename: 'SavedRecipe',
          id: savedRecipeId,
          folder: optimisticSavedRecipe.folder,
          tags: optimisticSavedRecipe.tags,
          notes: optimisticSavedRecipe.notes,
          personalRating: optimisticSavedRecipe.personalRating,
          cookedCount: optimisticSavedRecipe.cookedCount,
          lastCookedAt: optimisticSavedRecipe.lastCookedAt,
          createdAt: optimisticSavedRecipe.createdAt,
          updatedAt: optimisticSavedRecipe.updatedAt,
          recipe: edgeRecipe,
        };
        const newEdge: {
          __typename: 'SavedRecipeEdge';
          cursor: string;
          node: SavedRecipeEdgeNode;
        } = {
          __typename: 'SavedRecipeEdge',
          cursor: savedRecipeId,
          node,
        };
        return {
          ...existing,
          me: {
            ...existing.me,
            savedRecipesConnection: {
              ...existing.me.savedRecipesConnection,
              edges: [newEdge, ...existing.me.savedRecipesConnection.edges],
              totalCount:
                (existing.me.savedRecipesConnection.totalCount ?? 0) + 1,
            },
          },
        };
      },
    );

    return () => {
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
      client.cache.evict({ id: `SavedRecipe:${savedRecipeId}` });
      client.cache.gc();
    };
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
