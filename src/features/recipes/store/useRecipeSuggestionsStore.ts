import { create } from 'zustand';
import { registerSessionScopedStore } from '#store/sessionScopedStores';

import { immer } from 'zustand/middleware/immer';
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
  setCachedSuggestions: (
    itemName: string,
    recipes: RecipeInformation[],
  ) => void;
  clearExpiredCache: () => void;
  clearAllCache: () => void;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export const useRecipeSuggestionsStore = create<RecipeSuggestionsState>()(
  persist(
    immer((set, get) => ({
      cache: {},

      getCachedSuggestions: (itemName: string) => {
        const key = itemName.toLowerCase().trim();
        const cached = get().cache[key];

        if (!cached) return null;

        // Check if expired
        const now = Date.now();
        if (now - cached.cachedAt > CACHE_TTL_MS) {
          set(state => {
            delete state.cache[key];
          });
          return null;
        }

        return cached.recipes;
      },

      setCachedSuggestions: (
        itemName: string,
        recipes: RecipeInformation[],
      ) => {
        const key = itemName.toLowerCase().trim();
        set(state => {
          state.cache[key] = {
            recipes,
            cachedAt: Date.now(),
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

      clearAllCache: () =>
        set(state => {
          state.cache = {};
        }),
    })),
    {
      name: 'recipe-suggestions-cache',
      storage: createJSONStorage(() => zustandStorage),
      partialize: state => ({ cache: state.cache }),
    },
  ),
);

/**
 * Suggestions are keyed by the pantry items the previous person owned, and the
 * cache is persisted — so a sign-out on a shared device has to empty it.
 *
 * The root store's `SESSION_SCOPED_STATE` only reaches root state, so a feature
 * store is outside it by construction — which is exactly how this cache came to
 * survive a sign-out unnoticed.
 */
registerSessionScopedStore('useRecipeSuggestionsStore', () =>
  useRecipeSuggestionsStore.getState().clearAllCache(),
);
