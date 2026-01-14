import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { zustandStorage } from '#/storage/mmkv';
import type { RecipeInformation } from '#/services/recipeApi/types';

interface CachedSuggestion {
  recipes: RecipeInformation[];
  cachedAt: number;
}

interface RecipeSuggestionsState {
  // Cache keyed by item name (lowercase)
  cache: Record<string, CachedSuggestion>;

  // Actions
  getCachedSuggestions: (itemName: string) => RecipeInformation[] | null;
  setCachedSuggestions: (itemName: string, recipes: RecipeInformation[]) => void;
  clearExpiredCache: () => void;
  clearAllCache: () => void;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export const useRecipeSuggestionsStore = create<RecipeSuggestionsState>()(
  persist(
    (set, get) => ({
      cache: {},

      getCachedSuggestions: (itemName: string) => {
        const key = itemName.toLowerCase().trim();
        const cached = get().cache[key];

        if (!cached) return null;

        // Check if expired
        const now = Date.now();
        if (now - cached.cachedAt > CACHE_TTL_MS) {
          // Expired - remove from cache
          set(state => {
            const newCache = { ...state.cache };
            delete newCache[key];
            return { cache: newCache };
          });
          return null;
        }

        return cached.recipes;
      },

      setCachedSuggestions: (itemName: string, recipes: RecipeInformation[]) => {
        const key = itemName.toLowerCase().trim();
        set(state => ({
          cache: {
            ...state.cache,
            [key]: {
              recipes,
              cachedAt: Date.now(),
            },
          },
        }));
      },

      clearExpiredCache: () => {
        const now = Date.now();
        set(state => {
          const newCache: Record<string, CachedSuggestion> = {};
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
      name: 'recipe-suggestions-cache',
      storage: createJSONStorage(() => zustandStorage),
      partialize: state => ({ cache: state.cache }),
    }
  )
);
