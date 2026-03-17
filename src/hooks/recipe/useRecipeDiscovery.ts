import { useState, useEffect, useRef } from 'react';

import { useDefaultHome } from '#hooks/home/useDefaultHome';
import { usePantryManagement } from '#hooks/home/pantry/usePantryManagement';
import { useDietaryProfile } from '#hooks/profile/useDietaryProfile';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type {
  RecipeSearchResult,
  RecipeInformation,
} from '#/services/recipeApi/types';
import { useGetHomeQuery } from '#generated';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import {
  useRecipeCacheStore,
  ingredientCacheKey,
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
}

const INITIAL_DISCOVERY_STATE: DiscoveryState = {
  items: [],
  visibleCount: DISCOVERY_PAGE_SIZE,
  totalResults: 0,
};

interface UseRecipeDiscoveryResult {
  mode: DiscoveryMode;
  items: DiscoveryItem[];
  loading: boolean;
  refresh: () => void;
  pantryItems: any[];
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
    subtitleParts.push(`${recipe.servings} servings`);
  }
  const totalTime =
    recipe.readyInMinutes || recipe.preparationMinutes || recipe.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(`${totalTime} min`);
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: subtitleParts.join(' \u2022 '),
    badge: { text: 'Suggested' },
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
    subtitleParts.push(`${info.servings} servings`);
  }
  const totalTime =
    info?.readyInMinutes || info?.preparationMinutes || info?.cookingMinutes;
  if (totalTime) {
    subtitleParts.push(`${totalTime} min`);
  }

  return {
    id: String(recipe.id),
    title: recipe.title,
    subtitle: subtitleParts.join(' • ') || `${totalIngredients} ingredients`,
    badge: {
      text: `${recipe.usedIngredientCount}/${totalIngredients} match`,
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
  setMode: (v: DiscoveryMode) => void,
  setLoading: (v: boolean) => void,
  signal?: AbortSignal,
): Promise<void> {
  const guardedSetLoading = (v: boolean) => {
    if (!v && signal?.aborted) return;
    setLoading(v);
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
    guardedSetLoading(false);
    onResults(cachedResults, enrichmentMap);
    setMode('pantry');
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
      setMode('pantry');
    },
    guardedSetLoading,
    (error: unknown) => {
      if ((error as any).name === 'AbortError') return;
      console.error('Failed to fetch pantry-based recipes:', error);
    },
  );
}

/** Module-level helper: fetch random recipes */
async function fetchRandomDiscovery(
  setDiscoveryState: (
    updater: (prev: DiscoveryState) => DiscoveryState,
  ) => void,
  setMode: (v: DiscoveryMode) => void,
  setLoading: (v: boolean) => void,
  signal?: AbortSignal,
  dietaryTags?: string,
): Promise<void> {
  const guardedSetLoading = (v: boolean) => {
    if (!v && signal?.aborted) return;
    setLoading(v);
  };
  await executeWithLoadingState(
    async () => {
      const results = await spoonacularService.getRandomRecipes(
        { number: 10, tags: dietaryTags },
        signal,
      );
      if (signal?.aborted) return;
      const items = results.map(transformRandomRecipe);
      setDiscoveryState(() => ({
        items,
        visibleCount: items.length,
        totalResults: items.length,
      }));
      setMode('random');
    },
    guardedSetLoading,
    (error: unknown) => {
      if ((error as any).name === 'AbortError') return;
      console.error('Failed to fetch random recipes:', error);
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
export function useRecipeDiscovery(): UseRecipeDiscoveryResult {
  const {
    state: { selectedHomeId },
    actions: { getDefaultPantry },
  } = useDefaultHome();

  const { data: homeData } = useGetHomeQuery({
    variables: { homeId: selectedHomeId ?? '' },
    skip: !selectedHomeId,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const defaultPantry = getDefaultPantry(homeData);
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

  // Dietary profile — used as tags for random recipe discovery
  const { profile: dietaryProfile } = useDietaryProfile();
  const dietaryTags = (() => {
    const tags: string[] = [];
    const dietRestriction = dietaryProfile?.restrictions?.find(
      (r: any) => r.diet,
    );
    if (dietRestriction?.diet) {
      tags.push(dietRestriction.diet.toLowerCase());
    }
    return tags.length > 0 ? tags.join(',') : undefined;
  })();

  // All raw results from the API (pantry mode only)
  const allResultsRef = useRef<RecipeSearchResult[]>([]);
  // Enrichment info map — accumulated across batches
  const infoMapRef = useRef<Map<number, RecipeInformation>>(new Map());

  // Combined state — single setState = single render
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(
    INITIAL_DISCOVERY_STATE,
  );
  const [mode, setMode] = useState<DiscoveryMode>('none');
  const [loading, setLoading] = useState(true);

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

  // Load more: increase visible count and enrich the new batch
  const loadMoreDiscovery = () => {
    const allResults = allResultsRef.current;
    const { visibleCount } = discoveryState;
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
    mode === 'pantry' &&
    discoveryState.visibleCount < discoveryState.totalResults;

  // Fetch-key pattern: compute a stable key that changes when we should re-fetch.
  const [fetchKey, setFetchKey] = useState('');

  const shouldFetch = !pantryLoading;

  const currentKey = shouldFetch ? `fetch|${pantryItems?.length ?? 0}` : '';

  // Adjusting state during render: trigger fetch when conditions are met and key changed
  if (currentKey && currentKey !== fetchKey) {
    setFetchKey(currentKey);
  }

  // Effect depends only on stable values — no function deps
  useEffect(() => {
    if (!fetchKey) return;

    const controller = new AbortController();

    const ingredientNames = (pantryItems ?? [])
      .map(item => item.itemName)
      .filter(Boolean)
      .slice(0, 20)
      .join(',');

    if (ingredientNames) {
      fetchPantryDiscovery(
        ingredientNames,
        handlePantryResultsRef.current,
        setMode,
        setLoading,
        controller.signal,
      );
    } else {
      fetchRandomDiscovery(
        setDiscoveryState,
        setMode,
        setLoading,
        controller.signal,
        dietaryTags,
      );
    }

    return () => controller.abort();
  }, [fetchKey, pantryItems, dietaryTags]);

  // Refresh: re-fetch discovery recipes (bypasses cache)
  const refresh = () => {
    if (loading) return;

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
        setMode,
        setLoading,
      );
    } else {
      fetchRandomDiscovery(
        setDiscoveryState,
        setMode,
        setLoading,
        undefined,
        dietaryTags,
      );
    }
  };

  return {
    mode,
    items: discoveryState.items,
    loading,
    refresh,
    pantryItems: pantryItems ?? [],
    hasPantryItems,
    pantryHasMore,
    pantryLoadingMore,
    loadMorePantryItems,
    discoveryHasMore,
    loadMoreDiscovery,
  };
}
