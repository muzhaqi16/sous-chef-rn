import { useState, useEffect, useRef } from 'react';
import { errorService } from '#/services/errorService';

import { useDefaultHome } from '#hooks/home/useDefaultHome';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import type { PantryListItemNode } from '#hooks/home/pantry/usePantryQuery';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  RecipeSearchResult,
  RecipeInformation,
} from '#/services/recipeApi/types';
import { useQuery } from '@apollo/client/react';
import { GetHomeDocument } from '#operations/home/home.generated';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { t } from '#/i18n/t';
import {
  useRecipeCacheStore,
  ingredientCacheKey,
  randomCacheKey,
} from '#/store/useRecipeCacheStore';

export type DiscoveryMode = 'pantry' | 'random' | 'none';

export interface DiscoveryItem {
  id: string;
  title: string;
  subtitle: string;
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  };
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

const EMPTY_PANTRY_ITEMS: PantryListItemNode[] = [];

interface UseRecipeDiscoveryResult {
  mode: DiscoveryMode;
  items: DiscoveryItem[];
  loading: boolean;
  refresh: () => void;
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
    subtitleParts.push(`${recipe.servings} ${t('recipes.servingsSuffix')}`);
  }
  const totalTime =
    recipe.readyInMinutes || recipe.preparationMinutes || recipe.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(`${totalTime} ${t('recipes.minutes')}`);
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: subtitleParts.join(' \u2022 '),
    badge: { text: t('recipes.suggested') },
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
    subtitleParts.push(`${info.servings} ${t('recipes.servingsSuffix')}`);
  }
  const totalTime =
    info?.readyInMinutes || info?.preparationMinutes || info?.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(`${totalTime} ${t('recipes.minutes')}`);
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle:
      subtitleParts.join(' • ') ||
      `${totalIngredients} ${t('recipes.ingredientsSuffix')}`,
    badge: {
      text: `${recipe.usedIngredientCount}/${totalIngredients} ${t(
        'recipes.match',
      )}`,
      variant: 'primary',
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

/** Module-level helper: fetch pantry-based recipes (with cache) */
async function fetchPantryDiscovery(
  ingredientNames: string,
  onResults: (
    results: RecipeSearchResult[],
    cachedEnrichment?: Map<number, RecipeInformation>,
  ) => void,
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
    onResults(cachedResults, enrichmentMap);
    updateState({ loading: false, mode: 'pantry' });
    return;
  }

  await executeWithLoadingState(
    async () => {
      const results = await spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientNames,
        number: DISCOVERY_FETCH_SIZE,
        ranking: 1,
        ignorePantry: true,
      });
      if (signal?.aborted) return;

      // Cache the raw results (enrichment added later via updateEnrichment)
      cacheStore.setCached(cacheKey, results);

      onResults(results);
      updateState({ mode: 'pantry' });
    },
    guardedSetLoading,
    (error: unknown) => {
      // Aborts are expected (screen unmount / dietary-tag change). The error
      // name varies by fetch polyfill — RN's throws `Error: Aborted`, not a
      // DOMException named 'AbortError' — so key off the signal, not the shape.
      if (signal?.aborted) return;
      errorService.reportError(error, {
        operation: 'fetchPantryBasedRecipes',
      });
    },
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
      const results = await spoonacularService.getRandomRecipes(
        { number: DISCOVERY_FETCH_SIZE, tags: dietaryTags },
        signal,
      );
      if (signal?.aborted) return;

      cacheStore.setCached(cacheKey, results);
      onResults(results);
      updateState({ mode: 'random' });
    },
    guardedSetLoading,
    (error: unknown) => {
      // See fetchPantryDiscovery: aborts are expected; key off the signal.
      if (signal?.aborted) return;
      errorService.reportError(error, { operation: 'fetchRandomRecipes' });
    },
  );
}

/**
 * Manages recipe discovery. Prefers pantry-based ingredient search if user
 * has pantry items, falls back to random recipe suggestions otherwise.
 *
 * Fetches up to 50 pantry recipes in one API call (cached for 24h),
 * then paginates client-side (15 at a time). Bulk enrichment (cook time,
 * servings) is fetched per visible batch and deferred to idle time.
 */
export function useRecipeDiscovery(
  dietaryTags?: string,
): UseRecipeDiscoveryResult {
  const {
    state: { selectedHomeId },
    actions: { getDefaultPantry },
  } = useDefaultHome();

  const { data: homeData } = useQuery(GetHomeDocument, {
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
  });

  const defaultPantry = getDefaultPantry(homeData?.home);
  const {
    state: {
      items: pantryItems,
      loading: pantryLoading,
      hasMore: pantryHasMore,
      isLoadingMore: pantryLoadingMore,
    },
    actions: { loadMore: loadMorePantryItems },
  } = usePantryManagement(defaultPantry?.id);

  const hasPantryItems = (pantryItems?.length ?? 0) > 0;

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
  const handlePantryResults = (
    results: RecipeSearchResult[],
    cachedEnrichment?: Map<number, RecipeInformation>,
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
          const enrichmentRecord: Record<number, RecipeInformation> = {};
          updatedMap.forEach((v, k) => {
            enrichmentRecord[k] = v;
          });
          const cacheStore = useRecipeCacheStore.getState();
          const cacheEntries = Object.keys(cacheStore.cache);
          const matchingKey = cacheEntries.find(k =>
            k.startsWith('ingredient:'),
          );
          if (matchingKey) {
            cacheStore.updateEnrichment(matchingKey, enrichmentRecord);
          }

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

  const currentKey = shouldFetch ? `fetch|${pantryItems?.length ?? 0}` : '';

  // Adjusting state during render: trigger fetch when conditions are met and key changed
  if (currentKey && currentKey !== fetchKey) {
    setFetchKey(currentKey);
  }

  // Read pantryItems via a ref inside the fetch effect so the effect can
  // depend only on the stable `fetchKey` (which already encodes the item
  // count). Keeping `pantryItems` in the dep array re-ran the effect on every
  // reference change (cache-and-network re-renders churn the array identity) —
  // and each re-run's cleanup aborted the in-flight Spoonacular request, so
  // the first visit's discovery fetch was cancelled over and over. Because the
  // abort path guards `loading` from being cleared, the skeleton stayed up
  // until a later visit warmed the cache.
  const pantryItemsRef = useRef(pantryItems);
  useEffect(() => {
    pantryItemsRef.current = pantryItems;
  });

  // Effect depends only on stable values — no function deps
  useEffect(() => {
    if (!fetchKey) return;

    const controller = new AbortController();

    const ingredientNames = (pantryItemsRef.current ?? [])
      .map(item => item.itemName)
      .filter(Boolean)
      .slice(0, 20)
      .join(',');

    if (ingredientNames) {
      fetchPantryDiscovery(
        ingredientNames,
        handlePantryResultsRef.current,
        updateState,
        controller.signal,
      );
    } else {
      fetchRandomDiscovery(
        handleRandomResultsRef.current,
        updateState,
        controller.signal,
        dietaryTags,
      );
    }

    return () => controller.abort();
  }, [fetchKey, dietaryTags]);

  // Refresh: re-fetch discovery recipes (bypasses cache)
  const refresh = () => {
    if (discoveryState.loading) return;

    // Clear cache for this search so we get fresh results
    const ingredientNames = (pantryItems ?? [])
      .map(item => item.itemName)
      .filter(Boolean)
      .slice(0, 20)
      .join(',');

    if (ingredientNames) {
      // Remove from cache so fetchPantryDiscovery fetches fresh
      const cacheKey = ingredientCacheKey(ingredientNames);
      const cacheStore = useRecipeCacheStore.getState();
      const newCache = { ...cacheStore.cache };
      delete newCache[cacheKey];
      cacheStore.clearAllCache(); // Simple: clear all on refresh
      // Re-use the same setCached pattern on fresh fetch

      fetchPantryDiscovery(
        ingredientNames,
        handlePantryResultsRef.current,
        updateState,
      );
    } else {
      // Clear random cache so we get fresh results
      const cacheKey = randomCacheKey(dietaryTags);
      const cacheStore = useRecipeCacheStore.getState();
      const newCache = { ...cacheStore.cache };
      delete newCache[cacheKey];
      useRecipeCacheStore.setState({ cache: newCache });

      fetchRandomDiscovery(
        handleRandomResultsRef.current,
        updateState,
        undefined,
        dietaryTags,
      );
    }
  };

  return {
    mode: discoveryState.mode,
    items: discoveryState.items,
    loading: discoveryState.loading,
    refresh,
    pantryItems: pantryItems ?? EMPTY_PANTRY_ITEMS,
    hasPantryItems,
    pantryHasMore,
    pantryLoadingMore,
    loadMorePantryItems,
    discoveryHasMore,
    loadMoreDiscovery,
  };
}
