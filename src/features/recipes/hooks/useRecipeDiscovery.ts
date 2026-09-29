import { useState, useEffect, useRef } from 'react';
import { errorService } from '#/services/errorService';

import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import type {
  RecipeSearchResult,
  RecipeInformation,
} from '#/services/spoonacular/types';
import { useFocusEffect } from '@react-navigation/native';
import { defaultPantryOf } from '#domain/homePantries';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import { t } from '#/i18n';
import type { BadgeContent } from '#components/atoms/Badge';
import {
  useRecipeCacheStore,
  ingredientCacheKey,
  randomCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';

export type DiscoveryMode = 'pantry' | 'random' | 'none';

export interface DiscoveryItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: BadgeContent;
  imageUrl?: string;
  spoonacularId: number;
}

const DISCOVERY_PAGE_SIZE = 15;
const DISCOVERY_FETCH_SIZE = 25;

// Combined state to avoid multiple separate renders
interface DiscoveryState {
  items: DiscoveryItem[];
  visibleCount: number;
  totalResults: number;
  mode: DiscoveryMode;
  loading: boolean;
}

const INITIAL_DISCOVERY_STATE: DiscoveryState = {
  items: [],
  visibleCount: DISCOVERY_PAGE_SIZE,
  totalResults: 0,
  mode: 'none',
  loading: true,
};

interface UseRecipeDiscoveryResult {
  mode: DiscoveryMode;
  items: DiscoveryItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  pantryItems: PantryListItemNode[];
  hasPantryItems: boolean;
  pantryHasMore: boolean;
  pantryLoadingMore: boolean;
  loadMorePantryItems: () => void;
  discoveryHasMore: boolean;
  loadMoreDiscovery: () => void;
}

/** Transforms a RecipeInformation (random recipe) into a DiscoveryItem */
function transformRandomRecipe(recipe: RecipeInformation): DiscoveryItem {
  const subtitleParts: string[] = [];
  if (recipe.servings) {
    subtitleParts.push(t('recipes.servingsCount', { count: recipe.servings }));
  }
  const totalTime =
    recipe.readyInMinutes || recipe.preparationMinutes || recipe.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(t('labels.min', { count: totalTime }));
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: subtitleParts.join(' \u2022 '),
    badge: { text: t('labels.suggested') },
    imageUrl: recipe.image,
    spoonacularId: recipe.id,
  };
}

/** Transforms a pantry search result into a DiscoveryItem, enriched with bulk info */
function transformPantryResult(
  recipe: RecipeSearchResult,
  info?: RecipeInformation,
): DiscoveryItem {
  const totalIngredients =
    recipe.usedIngredientCount + recipe.missedIngredientCount;

  const subtitleParts: string[] = [];
  if (recipe.likes) {
    subtitleParts.push(`❤️ ${recipe.likes}`);
  }
  if (info?.servings) {
    subtitleParts.push(t('recipes.servingsCount', { count: info.servings }));
  }
  // Spoonacular reports an unknown duration as 0, so a zero falls through.
  const totalTime = [
    info?.readyInMinutes,
    info?.preparationMinutes,
    info?.cookingMinutes,
  ].find(minutes => minutes !== undefined && minutes !== 0);
  if (totalTime) {
    subtitleParts.push(t('labels.min', { count: totalTime }));
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle:
      subtitleParts.join(' • ') ||
      t('recipes.ingredientCount', { count: totalIngredients }),
    badge: {
      text: t('recipes.pantryMatchLabel', {
        used: recipe.usedIngredientCount,
        count: totalIngredients,
        missing: recipe.missedIngredientCount,
      }),
      lines: [
        {
          icon: 'checkmark-circle',
          text: String(recipe.usedIngredientCount),
          variant: 'success',
        },
        {
          icon: 'cart-outline',
          text: String(recipe.missedIngredientCount),
          variant: 'warning',
        },
      ],
    },
    imageUrl: recipe.image,
    spoonacularId: recipe.id,
  };
}

/** Enrich a batch of search results with bulk recipe info (cook time, servings) */
async function enrichBatch(
  results: RecipeSearchResult[],
  infoMap: Map<number, RecipeInformation>,
  signal?: AbortSignal,
): Promise<Map<number, RecipeInformation>> {
  const idsToFetch = results.map(r => r.id).filter(id => !infoMap.has(id));

  if (idsToFetch.length === 0) return infoMap;

  const infos = await spoonacularService.getBulkRecipeInformation(
    idsToFetch,
    signal,
  );
  const updated = new Map(infoMap);
  for (const info of infos) {
    updated.set(info.id, info);
  }
  return updated;
}

function ingredientQueryOf(pantryItems: PantryListItemNode[]): string {
  return pantryItems
    .map(item => item.itemName)
    .filter(Boolean)
    .slice(0, 20)
    .join(',');
}

function searchPantryRecipes(
  cacheKey: string,
  ingredientNames: string,
): Promise<RecipeSearchResult[]> {
  return useRecipeCacheStore.getState().getOrFetchResults(cacheKey, () =>
    spoonacularService.searchRecipesByIngredients({
      ingredients: ingredientNames,
      number: DISCOVERY_FETCH_SIZE,
      ranking: 1,
      ignorePantry: true,
    }),
  );
}

function enrichmentRecordOf(
  infoMap: Map<number, RecipeInformation>,
): Record<number, RecipeInformation> {
  const record: Record<number, RecipeInformation> = {};
  infoMap.forEach((info, id) => {
    record[id] = info;
  });
  return record;
}

type PantryResultsHandler = (
  cacheKey: string,
  results: RecipeSearchResult[],
  cachedEnrichment?: Map<number, RecipeInformation>,
) => void;

/**
 * A refresh bypasses the cache and resolves only once the new first page is
 * enriched, so the rows on screen stay until complete replacements exist.
 * Enrichment already held for a returning recipe is reused, not re-billed.
 */
async function refetchPantryDiscovery(
  ingredientNames: string,
  knownInfo: Map<number, RecipeInformation>,
): Promise<{
  cacheKey: string;
  results: RecipeSearchResult[];
  enrichment: Map<number, RecipeInformation>;
}> {
  const cacheKey = ingredientCacheKey(ingredientNames);
  const results = await searchPantryRecipes(cacheKey, ingredientNames);
  const enrichment = await enrichBatch(
    results.slice(0, DISCOVERY_PAGE_SIZE),
    knownInfo,
  ).catch(() => knownInfo);
  useRecipeCacheStore
    .getState()
    .setCached(cacheKey, results, enrichmentRecordOf(enrichment));
  return { cacheKey, results, enrichment };
}

/** Module-level helper: fetch pantry-based recipes (with cache) */
async function fetchPantryDiscovery(
  ingredientNames: string,
  onResults: PantryResultsHandler,
  updateState: (partial: Partial<DiscoveryState>) => void,
  signal?: AbortSignal,
): Promise<void> {
  const guardedSetLoading = (v: boolean) => {
    if (!v && signal?.aborted) return;
    updateState({ loading: v });
  };

  const cacheKey = ingredientCacheKey(ingredientNames);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    // Cache hit — use cached results + enrichment
    const cachedResults = cached.results as RecipeSearchResult[];
    const enrichmentMap = new Map(
      Object.entries(cached.enrichment).map(([k, v]) => [Number(k), v]),
    );
    onResults(cacheKey, cachedResults, enrichmentMap);
    updateState({ loading: false, mode: 'pantry' });
    return;
  }

  await executeWithLoadingState(
    async () => {
      // Run to completion (no abort signal) and de-dupe against any request
      // already in flight for this key, so navigating away mid-fetch neither
      // wastes the in-flight request nor lets a remount fire a duplicate.
      const results = await searchPantryRecipes(cacheKey, ingredientNames);

      // Warm the shared cache before the abort guard: the result is valid for
      // this key regardless of whether this mount still needs it, so a later
      // visit gets a cache hit (enrichment added later via updateEnrichment).
      cacheStore.setCached(cacheKey, results);

      // Only the on-screen state updates are gated on the signal — a late
      // response must not overwrite what the current mount is showing.
      if (signal?.aborted) return;
      onResults(cacheKey, results);
      updateState({ mode: 'pantry' });
    },
    guardedSetLoading,
    (error: unknown) => {
      if (signal?.aborted) return;
      errorService.reportError(error, {
        operation: 'fetchPantryBasedRecipes',
      });
    },
  );
}

function fetchRandomRecipes(
  cacheKey: string,
  dietaryTags?: string,
): Promise<RecipeInformation[]> {
  return useRecipeCacheStore.getState().getOrFetchResults(cacheKey, () =>
    spoonacularService.getRandomRecipes({
      number: DISCOVERY_FETCH_SIZE,
      tags: dietaryTags,
    }),
  );
}

/** Module-level helper: fetch random recipes (with cache) */
async function fetchRandomDiscovery(
  onResults: (results: RecipeInformation[]) => void,
  updateState: (partial: Partial<DiscoveryState>) => void,
  signal?: AbortSignal,
  dietaryTags?: string,
): Promise<void> {
  const guardedSetLoading = (v: boolean) => {
    if (!v && signal?.aborted) return;
    updateState({ loading: v });
  };

  const cacheKey = randomCacheKey(dietaryTags);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    const cachedResults = cached.results as RecipeInformation[];
    onResults(cachedResults);
    updateState({ loading: false, mode: 'random' });
    return;
  }

  await executeWithLoadingState(
    async () => {
      // Complete in the background + de-dupe concurrent callers (see
      // fetchPantryDiscovery). No abort signal: a client-side abort can't
      // refund the Spoonacular quota already spent on the in-flight request,
      // so discarding it would only pay a second unit on the next visit.
      const results = await fetchRandomRecipes(cacheKey, dietaryTags);

      cacheStore.setCached(cacheKey, results);
      if (signal?.aborted) return;
      onResults(results);
      updateState({ mode: 'random' });
    },
    guardedSetLoading,
    (error: unknown) => {
      if (signal?.aborted) return;
      errorService.reportError(error, { operation: 'fetchRandomRecipes' });
    },
  );
}

/**
 * Pantry-based ingredient search where the user has pantry items, random
 * suggestions otherwise. Up to 50 recipes in one call (cached 24h), paginated
 * client-side 15 at a time; enrichment is fetched per batch, deferred to idle.
 */
export function useRecipeDiscovery(
  dietaryTags?: string,
): UseRecipeDiscoveryResult {
  // From the cache: `useDefaultHome` owns the homes fetch.
  const { currentHome } = useCurrentHome();
  const defaultPantry = defaultPantryOf(currentHome);

  // Focus gate for the pantry watch: the Recipes tab stays mounted while hidden
  // (`inactiveBehavior: 'none'`), so a live watcher re-renders on every pantry
  // write and calls the recipe API from a hidden tab. Blurred, the watch is
  // skipped and `usePreservedConnection` holds the last result; on focus it
  // resumes `cache-first`. Starts FOCUSED — tabs are lazy, and a blurred first
  // render would fire a throwaway random-mode fetch.
  const [isFocused, setIsFocused] = useState(true);
  const [onFocusChange] = useState(() => () => {
    setIsFocused(true);
    return () => setIsFocused(false);
  });
  useFocusEffect(onFocusChange);

  const {
    state: {
      items: pantryItems,
      loading: pantryLoading,
      hasMore: pantryHasMore,
      isLoadingMore: pantryLoadingMore,
    },
    actions: { loadMore: loadMorePantryItems },
  } = usePantryManagement(defaultPantry?.id, {
    skip: !isFocused,
    fetchPolicy: 'cache-first',
  });

  const hasPantryItems = pantryItems.length > 0;

  // All raw results from the API (pantry mode only)
  const allResultsRef = useRef<RecipeSearchResult[]>([]);
  // All raw results from the API (random mode only)
  const allRandomResultsRef = useRef<RecipeInformation[]>([]);
  // Enrichment info map — accumulated across batches
  const infoMapRef = useRef<Map<number, RecipeInformation>>(new Map());

  // Combined state — single setState = single render
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(
    INITIAL_DISCOVERY_STATE,
  );

  // Partial updater for module-level helpers (avoids passing multiple setters)
  const updateState = (partial: Partial<DiscoveryState>) => {
    setDiscoveryState(prev => ({ ...prev, ...partial }));
  };

  // Handle raw results: store them, show first page, enrich it
  const handlePantryResults: PantryResultsHandler = (
    cacheKey,
    results,
    cachedEnrichment,
  ) => {
    allResultsRef.current = results;
    const enrichment = cachedEnrichment ?? new Map<number, RecipeInformation>();
    infoMapRef.current = enrichment;

    const firstPage = results.slice(0, DISCOVERY_PAGE_SIZE);

    // Single state update — 1 render instead of 3
    setDiscoveryState({
      items: firstPage.map(r => transformPantryResult(r, enrichment.get(r.id))),
      visibleCount: DISCOVERY_PAGE_SIZE,
      totalResults: results.length,
      mode: 'pantry',
      loading: false,
    });

    // Skip enrichment if we already have cached enrichment
    if (cachedEnrichment && cachedEnrichment.size > 0) return;

    // Enrich first page in background, deferred to idle
    if (firstPage.length > 0) {
      enrichBatch(firstPage, enrichment)
        .then(updatedMap => {
          infoMapRef.current = updatedMap;

          // Store enrichment in cache for future visits
          useRecipeCacheStore
            .getState()
            .updateEnrichment(cacheKey, enrichmentRecordOf(updatedMap));

          // Defer the UI update to idle time — enrichment is supplementary
          requestIdleCallback(() => {
            const visible = results.slice(0, DISCOVERY_PAGE_SIZE);
            setDiscoveryState(prev => ({
              ...prev,
              items: visible.map(r =>
                transformPantryResult(r, updatedMap.get(r.id)),
              ),
            }));
          });
        })
        .catch(() => {
          // Enrichment failed — keep showing basic results
        });
    }
  };

  // Stabilize handlePantryResults via ref (avoids effect re-fires)
  const handlePantryResultsRef = useRef(handlePantryResults);
  useEffect(() => {
    handlePantryResultsRef.current = handlePantryResults;
  });

  // Handle raw random results: store them, show first page
  const handleRandomResults = (results: RecipeInformation[]) => {
    allRandomResultsRef.current = results;
    const firstPage = results.slice(0, DISCOVERY_PAGE_SIZE);
    setDiscoveryState({
      items: firstPage.map(transformRandomRecipe),
      visibleCount: DISCOVERY_PAGE_SIZE,
      totalResults: results.length,
      mode: 'random',
      loading: false,
    });
  };

  const handleRandomResultsRef = useRef(handleRandomResults);
  useEffect(() => {
    handleRandomResultsRef.current = handleRandomResults;
  });

  // Load more: increase visible count and enrich the new batch
  const loadMoreDiscovery = () => {
    const { visibleCount } = discoveryState;

    if (discoveryState.mode === 'random') {
      const allResults = allRandomResultsRef.current;
      if (visibleCount >= allResults.length) return;

      const newCount = Math.min(
        visibleCount + DISCOVERY_PAGE_SIZE,
        allResults.length,
      );
      const visible = allResults.slice(0, newCount);

      setDiscoveryState(prev => ({
        ...prev,
        visibleCount: newCount,
        items: visible.map(transformRandomRecipe),
      }));
      return;
    }

    // Pantry mode
    const allResults = allResultsRef.current;
    if (visibleCount >= allResults.length) return;

    const newCount = Math.min(
      visibleCount + DISCOVERY_PAGE_SIZE,
      allResults.length,
    );

    const currentInfoMap = infoMapRef.current;
    const visible = allResults.slice(0, newCount);

    // Single state update
    setDiscoveryState(prev => ({
      ...prev,
      visibleCount: newCount,
      items: visible.map(r =>
        transformPantryResult(r, currentInfoMap.get(r.id)),
      ),
    }));

    // Enrich the new batch, deferred to idle
    const newBatch = allResults.slice(visibleCount, newCount);
    enrichBatch(newBatch, currentInfoMap)
      .then(updatedMap => {
        infoMapRef.current = updatedMap;
        requestIdleCallback(() => {
          setDiscoveryState(prev => ({
            ...prev,
            items: allResults
              .slice(0, newCount)
              .map(r => transformPantryResult(r, updatedMap.get(r.id))),
          }));
        });
      })
      .catch(() => {
        // Enrichment failed — keep showing basic results
      });
  };

  const discoveryHasMore =
    discoveryState.mode !== 'none' &&
    discoveryState.visibleCount < discoveryState.totalResults;

  // Fetch-key pattern: compute a stable key that changes when we should re-fetch.
  const [fetchKey, setFetchKey] = useState('');

  const shouldFetch = !pantryLoading;

  const currentKey = shouldFetch ? `fetch|${pantryItems.length}` : '';

  // Adjusting state during render: trigger fetch when conditions are met and key changed
  if (currentKey && currentKey !== fetchKey) {
    setFetchKey(currentKey);
  }

  // Read through a ref so the fetch effect depends only on the stable
  // `fetchKey`, which already encodes the item count. `pantryItems` in the dep
  // array re-runs on every reference change, and each cleanup aborts the
  // in-flight request — leaving the skeleton up, since the abort path does not
  // clear `loading`.
  const pantryItemsRef = useRef(pantryItems);
  useEffect(() => {
    pantryItemsRef.current = pantryItems;
  });

  // Effect depends only on stable values — no function deps
  useEffect(() => {
    if (!fetchKey) return;

    const controller = new AbortController();

    const ingredientNames = ingredientQueryOf(pantryItemsRef.current);

    if (ingredientNames) {
      void fetchPantryDiscovery(
        ingredientNames,
        handlePantryResultsRef.current,
        updateState,
        controller.signal,
      );
    } else {
      void fetchRandomDiscovery(
        handleRandomResultsRef.current,
        updateState,
        controller.signal,
        dietaryTags,
      );
    }

    return () => controller.abort();
  }, [fetchKey, dietaryTags]);

  // Bypasses the cache without clearing it: the rows on screen and the cached
  // entry both stay until a non-empty result replaces them, and the promise
  // settles only then so a pull-to-refresh spinner spans the whole fetch.
  const refresh = async () => {
    if (discoveryState.loading) return;

    const ingredientNames = ingredientQueryOf(pantryItems);
    const setLoading = (loading: boolean) => updateState({ loading });

    if (ingredientNames) {
      await executeWithLoadingState(
        async () => {
          const fresh = await refetchPantryDiscovery(
            ingredientNames,
            infoMapRef.current,
          );
          if (fresh.results.length === 0) return;
          handlePantryResultsRef.current(
            fresh.cacheKey,
            fresh.results,
            fresh.enrichment,
          );
        },
        setLoading,
        (error: unknown) => {
          errorService.reportError(error, {
            operation: 'refreshPantryBasedRecipes',
          });
        },
      );
      return;
    }

    await executeWithLoadingState(
      async () => {
        const cacheKey = randomCacheKey(dietaryTags);
        const results = await fetchRandomRecipes(cacheKey, dietaryTags);
        if (results.length === 0) return;
        useRecipeCacheStore.getState().setCached(cacheKey, results);
        handleRandomResultsRef.current(results);
      },
      setLoading,
      (error: unknown) => {
        errorService.reportError(error, { operation: 'refreshRandomRecipes' });
      },
    );
  };

  return {
    mode: discoveryState.mode,
    items: discoveryState.items,
    loading: discoveryState.loading,
    refresh,
    pantryItems,
    hasPantryItems,
    pantryHasMore,
    pantryLoadingMore,
    // `usePagination` catches a failed page itself.
    loadMorePantryItems: () => {
      void loadMorePantryItems();
    },
    discoveryHasMore,
    loadMoreDiscovery,
  };
}
