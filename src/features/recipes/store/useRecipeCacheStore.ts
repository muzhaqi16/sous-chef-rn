import { create } from 'zustand';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import type {
  RecipeSearchResult,
  SearchRecipesResult,
  RecipeInformation,
  RecipePriceBreakdown,
} from '#/services/spoonacular/types';

interface CachedRecipeSearch {
  results: (RecipeSearchResult | SearchRecipesResult | RecipeInformation)[];
  enrichment: Record<number, RecipeInformation>;
  cachedAt: number;
  // Source's total result count at fetch time (text search pagination reads
  // this so a cache hit doesn't lose the "is there more?" signal). Optional:
  // entries persisted before the field existed, and non-paginated searches,
  // don't carry it.
  totalResults?: number | null;
}

interface CachedLookup<T> {
  data: T;
  cachedAt: number;
}

interface RecipeCacheState {
  cache: Record<string, CachedRecipeSearch>;
  /** `/information` with nutrition, keyed by Spoonacular recipe id. */
  details: Record<string, CachedLookup<RecipeInformation>>;
  /** `priceBreakdownWidget.json`, keyed by Spoonacular recipe id. */
  priceBreakdowns: Record<string, CachedLookup<RecipePriceBreakdown>>;

  getCached: (key: string) => CachedRecipeSearch | null;
  setCached: (
    key: string,
    results: (RecipeSearchResult | SearchRecipesResult | RecipeInformation)[],
    enrichment?: Record<number, RecipeInformation>,
    totalResults?: number | null,
  ) => void;
  getOrFetchResults: <T>(key: string, fetcher: () => Promise<T>) => Promise<T>;
  updateEnrichment: (
    key: string,
    enrichment: Record<number, RecipeInformation>,
  ) => void;
  clearExpiredCache: () => void;
  clearAllCache: () => void;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// A detail payload with nutrition runs to tens of KB and the store persists to
// MMKV, so each lookup map keeps only its most recent entries.
const MAX_LOOKUP_ENTRIES = 40;

const isFresh = (entry: { cachedAt: number } | undefined, now: number) =>
  entry !== undefined && now - entry.cachedAt <= CACHE_TTL_MS;

function withNewest<T>(
  entries: Record<string, CachedLookup<T>>,
  key: string,
  data: T,
): Record<string, CachedLookup<T>> {
  const next = { ...entries, [key]: { data, cachedAt: Date.now() } };
  const byAge = Object.entries(next).sort(
    ([, a], [, b]) => a.cachedAt - b.cachedAt,
  );
  const excess = Math.max(0, byAge.length - MAX_LOOKUP_ENTRIES);
  for (const [stale] of byAge.slice(0, excess)) {
    delete next[stale];
  }
  return next;
}

// In-flight network requests keyed by cache key, so a second caller for the
// same search latches onto the existing request instead of firing a duplicate.
// Ephemeral (not reactive, not persisted) — cleared as each request settles.
const inflightRequests = new Map<string, Promise<unknown>>();

/** Build a normalized cache key for ingredient-based searches */
export function ingredientCacheKey(ingredients: string): string {
  const sorted = ingredients
    .split(',')
    .map(s => s.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join(',');
  return `ingredient:${sorted}`;
}

/** Build a normalized cache key for text-based searches.
 *
 * `offset` distinguishes paginated pages of the same query: without it page 2
 * (offset 25) would collide with page 1 (offset 0) and the cache would serve
 * the first page's results for every "load more". Defaults to 0 so first-page
 * callers don't have to pass it. */
export function textSearchCacheKey(
  query: string,
  filters?: {
    diet?: string[];
    intolerances?: string[];
    mealType?: string | null;
    maxReadyTime?: number | null;
  },
  offset = 0,
): string {
  const parts = [`text:${query.toLowerCase().trim()}`];
  if (filters?.diet?.length)
    parts.push(`diet:${filters.diet.sort().join(',')}`);
  if (filters?.intolerances?.length)
    parts.push(`intol:${filters.intolerances.sort().join(',')}`);
  if (filters?.mealType) parts.push(`type:${filters.mealType}`);
  if (filters?.maxReadyTime) parts.push(`time:${filters.maxReadyTime}`);
  if (offset > 0) parts.push(`offset:${offset}`);
  return parts.join('|');
}

/** Build a normalized cache key for random recipe discovery */
export function randomCacheKey(tags?: string): string {
  if (!tags) return 'random:none';
  const sorted = tags
    .split(',')
    .map(s => s.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join(',');
  return `random:${sorted}`;
}

export const useRecipeCacheStore = create<RecipeCacheState>()(
  persist(
    immer((set, get) => ({
      cache: {},
      details: {},
      priceBreakdowns: {},

      getCached: (key: string) => {
        const cached = get().cache[key];
        if (!cached) return null;

        if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
          set(state => {
            delete state.cache[key];
          });
          return null;
        }

        // Empty result sets are never written (see setCached), but entries
        // persisted before that guard existed may still be in MMKV — purge
        // them on read so a transient zero-result response doesn't stick.
        if (cached.results.length === 0) {
          set(state => {
            delete state.cache[key];
          });
          return null;
        }

        return cached;
      },

      setCached: (key, results, enrichment = {}, totalResults = null) => {
        // Don't cache empty result sets: a transient zero (API hiccup,
        // over-restrictive filters) would otherwise stick for the full TTL.
        if (results.length === 0) return;
        set(state => {
          state.cache[key] = {
            results,
            enrichment,
            cachedAt: Date.now(),
            totalResults,
          };
        });
      },

      // De-dupe concurrent fetches for the same key. If a request for `key` is
      // already in flight (e.g. the screen was unmounted and remounted before
      // it resolved), return that same promise instead of starting a second
      // network call. The request runs to completion regardless of unmount, so
      // its caller can warm the cache — no wasted work, no wasted API quota.
      getOrFetchResults: (key, fetcher) => {
        const existing = inflightRequests.get(key);
        if (existing) return existing as ReturnType<typeof fetcher>;

        const promise = fetcher().finally(() => {
          inflightRequests.delete(key);
        });
        inflightRequests.set(key, promise);
        return promise;
      },

      updateEnrichment: (key, enrichment) => {
        set(state => {
          const existing = state.cache[key];
          if (!existing) return;
          state.cache[key] = {
            ...existing,
            enrichment: { ...existing.enrichment, ...enrichment },
          };
        });
      },

      clearExpiredCache: () => {
        const now = Date.now();
        set(state => {
          for (const [key, entry] of Object.entries(state.cache)) {
            if (now - entry.cachedAt > CACHE_TTL_MS) {
              delete state.cache[key];
            }
          }
          for (const [key, entry] of Object.entries(state.details)) {
            if (!isFresh(entry, now)) delete state.details[key];
          }
          for (const [key, entry] of Object.entries(state.priceBreakdowns)) {
            if (!isFresh(entry, now)) delete state.priceBreakdowns[key];
          }
        });
      },

      clearAllCache: () => {
        // Forget in-flight de-dupe tracking too: a full reset (e.g. logout)
        // shouldn't let a stale pending request block a fresh fetch. This only
        // drops the tracking entry — it can't cancel an already-issued request.
        inflightRequests.clear();
        set(state => {
          state.cache = {};
          state.details = {};
          state.priceBreakdowns = {};
        });
      },
    })),
    {
      name: 'recipe-search-cache',
      storage: createJSONStorage(() => zustandStorage),
      partialize: state => ({
        cache: state.cache,
        details: state.details,
        priceBreakdowns: state.priceBreakdowns,
      }),
    },
  ),
);

/**
 * Every Spoonacular request is billed, so a recipe's details are fetched once
 * per TTL: a repeat view, an add to a plan and a save all read this entry, and
 * concurrent callers share one request. Always requested with nutrition, the
 * form every caller needs for the ingest mirror.
 */
export async function fetchRecipeInformation(
  id: number,
  signal?: AbortSignal,
): Promise<RecipeInformation> {
  const key = String(id);
  const cached = useRecipeCacheStore.getState().details[key];
  if (isFresh(cached, Date.now()) && cached) return cached.data;

  // Stored inside the shared request, so a caller that aborts still leaves
  // the paid-for answer behind for the next one.
  return abortable(
    useRecipeCacheStore
      .getState()
      .getOrFetchResults(`info:${key}`, async () => {
        const data = await spoonacularService.getRecipeInformation({
          id,
          includeNutrition: true,
        });
        useRecipeCacheStore.setState(state => ({
          details: withNewest(state.details, key, data),
        }));
        return data;
      }),
    signal,
  );
}

/**
 * The server refreshes an imported recipe's mirror at most once per 24h, so a
 * price breakdown fetched again inside the TTL buys nothing.
 */
export async function fetchRecipePriceBreakdown(
  id: number,
): Promise<RecipePriceBreakdown> {
  const key = String(id);
  const cached = useRecipeCacheStore.getState().priceBreakdowns[key];
  if (isFresh(cached, Date.now()) && cached) return cached.data;

  return useRecipeCacheStore
    .getState()
    .getOrFetchResults(`price:${key}`, async () => {
      const data = await spoonacularService.getRecipePriceBreakdown(id);
      useRecipeCacheStore.setState(state => ({
        priceBreakdowns: withNewest(state.priceBreakdowns, key, data),
      }));
      return data;
    });
}

// The shared request runs to completion so its result is cached for whoever
// asks next; an aborted caller only stops waiting for it.
function abortable<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject);
  });
}

/**
 * Recipe searches name what the previous person was cooking and the cache is
 * persisted, so a sign-out has to empty it. `SESSION_SCOPED_STATE` reaches only
 * root state, so a feature store must register itself here.
 */
registerSessionScopedStore('useRecipeCacheStore', () =>
  useRecipeCacheStore.getState().clearAllCache(),
);
