import { useState, useEffect, useRef } from 'react';
import { useScreenFocusEffect } from '#platform/screen';
import { errorService } from '#/services/errorService';

import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';
import { usePantryManagement } from '#features/pantry/hooks/usePantryManagement';
import type { PantryListItemNode } from '#features/pantry/hooks/usePantryQuery';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import type {
  RecipeSearchResult,
  RecipeInformation,
} from '#/services/spoonacular/types';
import { defaultPantryOf } from '#domain/homePantries';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import type { RecipeRow } from '#features/recipes/utils/recipeRows';
import {
  useRecipeCacheStore,
  ingredientCacheKey,
  randomCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';

type DiscoveryMode = 'pantry' | 'random' | 'none';

const DISCOVERY_PAGE_SIZE = 15;
const DISCOVERY_FETCH_SIZE = 25;

type InfoMap = ReadonlyMap<number, RecipeInformation>;

/**
 * What discovery found: random recipes for an empty pantry, or what the pantry
 * can make with the enrichment fetched so far.
 */
type Found =
  | { mode: 'random'; recipes: RecipeInformation[] }
  | { mode: 'pantry'; recipes: RecipeSearchResult[]; info: InfoMap };

interface DiscoveryState {
  found: Found | null;
  visibleCount: number;
  loading: boolean;
}

type SetDiscoveryState = (
  update: (prev: DiscoveryState) => DiscoveryState,
) => void;

const INITIAL_DISCOVERY_STATE: DiscoveryState = {
  found: null,
  visibleCount: DISCOVERY_PAGE_SIZE,
  loading: true,
};

export interface SpoonacularDiscoveryResult {
  mode: DiscoveryMode;
  /** Any discovery's rows, so another source can stand in for these. */
  rows: RecipeRow[];
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

/** The first `count` recipes found, as rows that write their copy when shown. */
function rowsOf(found: Found | null, count: number): RecipeRow[] {
  if (!found) return [];
  if (found.mode === 'random') {
    return found.recipes
      .slice(0, count)
      .map((recipe): RecipeRow => ({ source: 'random', recipe }));
  }
  return found.recipes.slice(0, count).map(
    (recipe): RecipeRow => ({
      source: 'pantry',
      recipe,
      info: found.info.get(recipe.id),
    }),
  );
}

/** Enrich a batch of search results with bulk recipe info (cook time, servings) */
async function enrichBatch(
  results: RecipeSearchResult[],
  infoMap: InfoMap,
  signal?: AbortSignal,
): Promise<InfoMap> {
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

function enrichmentRecordOf(
  infoMap: InfoMap,
): Record<number, RecipeInformation> {
  const record: Record<number, RecipeInformation> = {};
  infoMap.forEach((info, id) => {
    record[id] = info;
  });
  return record;
}

/**
 * Enriches `batch` in the background and shows it once the JS thread idles:
 * enrichment is supplementary. With `cacheKey`, the cache keeps it too.
 */
function enrichInBackground(
  batch: RecipeSearchResult[],
  known: InfoMap,
  setState: SetDiscoveryState,
  cacheKey?: string,
): void {
  if (batch.length === 0) return;
  enrichBatch(batch, known)
    .then(info => {
      if (cacheKey) {
        useRecipeCacheStore
          .getState()
          .updateEnrichment(cacheKey, enrichmentRecordOf(info));
      }
      requestIdleCallback(() => {
        setState(prev =>
          prev.found?.mode === 'pantry'
            ? {
                ...prev,
                found: {
                  ...prev.found,
                  info: new Map([...prev.found.info, ...info]),
                },
              }
            : prev,
        );
      });
    })
    .catch(() => {
      // Enrichment failed — keep showing basic results
    });
}

/** Shows the first page of what was found, enriching it unless it already is. */
function show(found: Found, cacheKey: string, setState: SetDiscoveryState) {
  setState(() => ({
    found,
    visibleCount: DISCOVERY_PAGE_SIZE,
    loading: false,
  }));
  if (found.mode === 'pantry' && found.info.size === 0) {
    enrichInBackground(
      found.recipes.slice(0, DISCOVERY_PAGE_SIZE),
      found.info,
      setState,
      cacheKey,
    );
  }
}

function ingredientQueryOf(pantryItems: PantryListItemNode[]): string {
  return pantryItems
    .map(item => item.itemName)
    .filter(Boolean)
    .slice(0, 20)
    .join(',');
}

const cacheKeyOf = (ingredientNames: string, dietaryTags?: string) =>
  ingredientNames
    ? ingredientCacheKey(ingredientNames)
    : randomCacheKey(dietaryTags);

/** What the cache holds for this pantry, or for no pantry; null on a miss. */
function cachedFound(
  ingredientNames: string,
  dietaryTags?: string,
): Found | null {
  const cached = useRecipeCacheStore
    .getState()
    .getCached(cacheKeyOf(ingredientNames, dietaryTags));
  if (!cached) return null;
  return ingredientNames
    ? {
        mode: 'pantry',
        recipes: cached.results as RecipeSearchResult[],
        info: new Map(
          Object.entries(cached.enrichment).map(([k, v]) => [Number(k), v]),
        ),
      }
    : { mode: 'random', recipes: cached.results as RecipeInformation[] };
}

/**
 * Recipes the pantry can make, else random ones. Run to completion (no abort
 * signal) and de-duped against a request in flight for the key: a client-side
 * abort refunds no Spoonacular quota, and a remount fires no duplicate.
 */
async function fetchFound(
  ingredientNames: string,
  dietaryTags?: string,
): Promise<Found> {
  const cacheKey = cacheKeyOf(ingredientNames, dietaryTags);
  const { getOrFetchResults } = useRecipeCacheStore.getState();
  if (ingredientNames) {
    const recipes = await getOrFetchResults(cacheKey, () =>
      spoonacularService.searchRecipesByIngredients({
        ingredients: ingredientNames,
        number: DISCOVERY_FETCH_SIZE,
        ranking: 1,
        ignorePantry: true,
      }),
    );
    return { mode: 'pantry', recipes, info: new Map() };
  }
  const recipes = await getOrFetchResults(cacheKey, () =>
    spoonacularService.getRandomRecipes({
      number: DISCOVERY_FETCH_SIZE,
      tags: dietaryTags,
    }),
  );
  return { mode: 'random', recipes };
}

/** A cached discovery at once, else a fetch that warms the cache. */
async function loadDiscovery(
  ingredientNames: string,
  dietaryTags: string | undefined,
  setState: SetDiscoveryState,
  signal: AbortSignal,
): Promise<void> {
  const cacheKey = cacheKeyOf(ingredientNames, dietaryTags);
  const cached = cachedFound(ingredientNames, dietaryTags);
  if (cached) {
    show(cached, cacheKey, setState);
    return;
  }

  await executeWithLoadingState(
    async () => {
      const found = await fetchFound(ingredientNames, dietaryTags);
      // Warmed before the abort guard: the result is valid for this key
      // whether or not this mount still shows it.
      useRecipeCacheStore.getState().setCached(cacheKey, found.recipes);
      // A late response must not overwrite what the current mount shows.
      if (signal.aborted) return;
      show(found, cacheKey, setState);
    },
    loading => {
      if (!loading && signal.aborted) return;
      setState(prev => ({ ...prev, loading }));
    },
    (error: unknown) => {
      if (signal.aborted) return;
      errorService.reportError(error, {
        operation: ingredientNames
          ? 'fetchPantryBasedRecipes'
          : 'fetchRandomRecipes',
      });
    },
  );
}

/**
 * Pantry-based ingredient search, or random suggestions with an empty pantry:
 * one cached call, paged client-side, enriched per batch at idle. Not
 * `enabled`, only the ingredient picker's pantry watch runs.
 */
export function useSpoonacularDiscovery(
  dietaryTags?: string,
  { enabled = true }: { enabled?: boolean } = {},
): SpoonacularDiscoveryResult {
  // From the cache: `useDefaultHome` owns the homes fetch.
  const { currentHome } = useCurrentHome();
  const defaultPantry = defaultPantryOf(currentHome);

  // The Recipes tab stays mounted hidden, so blurred the pantry watch is
  // skipped and `usePreservedConnection` holds it. Starts FOCUSED: tabs are
  // lazy, and a blurred first render fires a throwaway random-mode fetch.
  const [isFocused, setIsFocused] = useState(true);
  const [onFocusChange] = useState(() => () => {
    setIsFocused(true);
    return () => setIsFocused(false);
  });
  useScreenFocusEffect(onFocusChange);

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

  // Combined state — single setState = single render
  const [discoveryState, setDiscoveryState] = useState<DiscoveryState>(
    INITIAL_DISCOVERY_STATE,
  );
  const { found, visibleCount } = discoveryState;

  const loadMoreDiscovery = () => {
    if (!found || visibleCount >= found.recipes.length) return;
    const nextCount = Math.min(
      visibleCount + DISCOVERY_PAGE_SIZE,
      found.recipes.length,
    );
    setDiscoveryState(prev => ({ ...prev, visibleCount: nextCount }));
    if (found.mode === 'pantry') {
      enrichInBackground(
        found.recipes.slice(visibleCount, nextCount),
        found.info,
        setDiscoveryState,
      );
    }
  };

  const discoveryHasMore = !!found && visibleCount < found.recipes.length;
  const rows = rowsOf(found, visibleCount);

  // Fetch-key pattern: compute a stable key that changes when we should re-fetch.
  const [fetchKey, setFetchKey] = useState('');

  const shouldFetch = !pantryLoading;

  const currentKey = shouldFetch ? `fetch|${pantryItems.length}` : '';

  // Adjusting state during render: trigger fetch when conditions are met and key changed
  if (currentKey && currentKey !== fetchKey) {
    setFetchKey(currentKey);
  }

  // Read through a ref so the fetch effect depends only on `fetchKey`: a
  // `pantryItems` dep re-runs on every new reference, and each cleanup aborts
  // the request, leaving the skeleton up.
  const pantryItemsRef = useRef(pantryItems);
  useEffect(() => {
    pantryItemsRef.current = pantryItems;
  });

  useEffect(() => {
    if (!fetchKey || !enabled) return;
    const controller = new AbortController();
    void loadDiscovery(
      ingredientQueryOf(pantryItemsRef.current),
      dietaryTags,
      setDiscoveryState,
      controller.signal,
    );
    return () => controller.abort();
  }, [fetchKey, dietaryTags, enabled]);

  // Bypasses the cache without clearing it: rows and entry stay until a
  // non-empty result replaces them, and the promise settles then, so the
  // refresh spinner spans the fetch. Held enrichment is reused, not re-billed.
  const refresh = async () => {
    if (!enabled || discoveryState.loading) return;

    const ingredientNames = ingredientQueryOf(pantryItems);
    const cacheKey = cacheKeyOf(ingredientNames, dietaryTags);
    const known: InfoMap = found?.mode === 'pantry' ? found.info : new Map();

    await executeWithLoadingState(
      async () => {
        const fresh = await fetchFound(ingredientNames, dietaryTags);
        if (fresh.recipes.length === 0) return;
        const enriched: Found =
          fresh.mode === 'pantry'
            ? {
                ...fresh,
                info: await enrichBatch(
                  fresh.recipes.slice(0, DISCOVERY_PAGE_SIZE),
                  known,
                ).catch(() => known),
              }
            : fresh;
        useRecipeCacheStore
          .getState()
          .setCached(
            cacheKey,
            enriched.recipes,
            enriched.mode === 'pantry'
              ? enrichmentRecordOf(enriched.info)
              : undefined,
          );
        show(enriched, cacheKey, setDiscoveryState);
      },
      loading => setDiscoveryState(prev => ({ ...prev, loading })),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: ingredientNames
            ? 'refreshPantryBasedRecipes'
            : 'refreshRandomRecipes',
        });
      },
    );
  };

  return {
    mode: found?.mode ?? 'none',
    rows,
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
