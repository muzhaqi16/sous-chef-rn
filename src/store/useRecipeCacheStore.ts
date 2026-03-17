import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import type {
  RecipeSearchResult,
  SearchRecipesResult,
  RecipeInformation,
} from '#/services/recipeApi/types';

interface CachedRecipeSearch {
  results: (RecipeSearchResult | SearchRecipesResult)[];
  enrichment: Record<number, RecipeInformation>;
  cachedAt: number;
}

interface RecipeCacheState {
  cache: Record<string, CachedRecipeSearch>;

  getCached: (key: string) => CachedRecipeSearch | null;
  setCached: (
    key: string,
    results: (RecipeSearchResult | SearchRecipesResult)[],
    enrichment?: Record<number, RecipeInformation>,
  ) => void;
  updateEnrichment: (
    key: string,
    enrichment: Record<number, RecipeInformation>,
  ) => void;
  clearExpiredCache: () => void;
  clearAllCache: () => void;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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

/** Build a normalized cache key for text-based searches */
export function textSearchCacheKey(
  query: string,
  filters?: {
    diet?: string[];
    intolerances?: string[];
    mealType?: string | null;
    maxReadyTime?: number | null;
  },
): string {
  const parts = [`text:${query.toLowerCase().trim()}`];
  if (filters?.diet?.length)
    parts.push(`diet:${filters.diet.sort().join(',')}`);
  if (filters?.intolerances?.length)
    parts.push(`intol:${filters.intolerances.sort().join(',')}`);
  if (filters?.mealType) parts.push(`type:${filters.mealType}`);
  if (filters?.maxReadyTime) parts.push(`time:${filters.maxReadyTime}`);
  return parts.join('|');
}

export const useRecipeCacheStore = create<RecipeCacheState>()(
  persist(
    (set, get) => ({
      cache: {},

      getCached: (key: string) => {
        const cached = get().cache[key];
        if (!cached) return null;

        if (Date.now() - cached.cachedAt > CACHE_TTL_MS) {
          set(state => {
            const newCache = { ...state.cache };
            delete newCache[key];
            return { cache: newCache };
          });
          return null;
        }

        return cached;
      },

      setCached: (key, results, enrichment = {}) => {
        set(state => ({
          cache: {
            ...state.cache,
            [key]: { results, enrichment, cachedAt: Date.now() },
          },
        }));
      },

      updateEnrichment: (key, enrichment) => {
        set(state => {
          const existing = state.cache[key];
          if (!existing) return state;
          return {
            cache: {
              ...state.cache,
              [key]: {
                ...existing,
                enrichment: { ...existing.enrichment, ...enrichment },
              },
            },
          };
        });
      },

      clearExpiredCache: () => {
        const now = Date.now();
        set(state => {
          const newCache: Record<string, CachedRecipeSearch> = {};
          Object.entries(state.cache).forEach(([key, value]) => {
            if (now - value.cachedAt <= CACHE_TTL_MS) {
              newCache[key] = value;
            }
          });
          return { cache: newCache };
        });
      },

      clearAllCache: () => set({ cache: {} }),
    }),
    {
      name: 'recipe-search-cache',
      storage: createJSONStorage(() => zustandStorage),
      partialize: state => ({ cache: state.cache }),
    },
  ),
);
