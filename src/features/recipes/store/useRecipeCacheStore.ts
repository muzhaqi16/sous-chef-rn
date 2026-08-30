import { create } from 'zustand';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

import { immer } from 'zustand/middleware/immer';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import type {
  RecipeSearchResult,
  SearchRecipesResult,
  RecipeInformation,
} from '#/services/recipeApi/types';

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

interface RecipeCacheState {
  cache: Record<string, CachedRecipeSearch>;

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
          for (const key of Object.keys(state.cache)) {
            if (now - state.cache[key].cachedAt > CACHE_TTL_MS) {
              delete state.cache[key];
            }
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
        });
      },
    })),
    {
      name: 'recipe-search-cache',
      storage: createJSONStorage(() => zustandStorage),
      partialize: state => ({ cache: state.cache }),
    },
  ),
);

/**
 * Recipe searches name what the previous person was cooking and the cache is
 * persisted, so a sign-out has to empty it. `SESSION_SCOPED_STATE` reaches only
 * root state, so a feature store must register itself here.
 */
registerSessionScopedStore('useRecipeCacheStore', () =>
  useRecipeCacheStore.getState().clearAllCache(),
);
