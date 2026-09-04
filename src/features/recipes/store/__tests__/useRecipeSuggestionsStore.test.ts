import { useRecipeSuggestionsStore } from '../useRecipeSuggestionsStore';
import type { RecipeInformation } from '#/services/spoonacular/types';

describe('useRecipeSuggestionsStore', () => {
  beforeEach(() => {
    useRecipeSuggestionsStore.getState().clearAllCache();
  });

  describe('setCachedSuggestions', () => {
    it('caches recipes by item name', () => {
      const recipes = [
        { id: 1, title: 'Pasta' },
      ] as Partial<RecipeInformation>[] as RecipeInformation[];
      useRecipeSuggestionsStore
        .getState()
        .setCachedSuggestions('Tomato', recipes);
      const cached = useRecipeSuggestionsStore
        .getState()
        .getCachedSuggestions('Tomato');
      expect(cached).toEqual(recipes);
    });

    it('normalizes key to lowercase and trimmed', () => {
      const recipes = [
        { id: 1, title: 'Soup' },
      ] as Partial<RecipeInformation>[] as RecipeInformation[];
      useRecipeSuggestionsStore
        .getState()
        .setCachedSuggestions('  CHICKEN  ', recipes);
      const cached = useRecipeSuggestionsStore
        .getState()
        .getCachedSuggestions('chicken');
      expect(cached).toEqual(recipes);
    });
  });

  describe('getCachedSuggestions', () => {
    it('returns null for uncached items', () => {
      expect(
        useRecipeSuggestionsStore.getState().getCachedSuggestions('Unknown'),
      ).toBeNull();
    });

    it('returns null for expired cache', () => {
      const recipes = [
        { id: 1, title: 'Old' },
      ] as Partial<RecipeInformation>[] as RecipeInformation[];
      useRecipeSuggestionsStore
        .getState()
        .setCachedSuggestions('item', recipes);
      // Manually expire the cache entry
      useRecipeSuggestionsStore.setState(state => {
        const key = 'item';
        if (state.cache[key]) {
          state.cache[key] = {
            ...state.cache[key],
            cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000, // 8 days ago
          };
        }
        return state;
      });
      expect(
        useRecipeSuggestionsStore.getState().getCachedSuggestions('item'),
      ).toBeNull();
    });

    it('removes expired entry from cache', () => {
      const recipes = [
        { id: 1 },
      ] as Partial<RecipeInformation>[] as RecipeInformation[];
      useRecipeSuggestionsStore
        .getState()
        .setCachedSuggestions('item', recipes);
      useRecipeSuggestionsStore.setState(state => {
        state.cache.item = {
          ...state.cache.item,
          cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        };
        return state;
      });
      useRecipeSuggestionsStore.getState().getCachedSuggestions('item');
      expect(useRecipeSuggestionsStore.getState().cache).not.toHaveProperty(
        'item',
      );
    });
  });

  describe('clearExpiredCache', () => {
    it('removes only expired entries', () => {
      const recipes = [
        { id: 1 },
      ] as Partial<RecipeInformation>[] as RecipeInformation[];
      useRecipeSuggestionsStore
        .getState()
        .setCachedSuggestions('fresh', recipes);
      useRecipeSuggestionsStore.getState().setCachedSuggestions('old', recipes);
      // Expire 'old' entry
      useRecipeSuggestionsStore.setState(state => {
        state.cache.old = {
          ...state.cache.old,
          cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        };
        return state;
      });
      useRecipeSuggestionsStore.getState().clearExpiredCache();
      expect(useRecipeSuggestionsStore.getState().cache).toHaveProperty(
        'fresh',
      );
      expect(useRecipeSuggestionsStore.getState().cache).not.toHaveProperty(
        'old',
      );
    });
  });

  describe('clearAllCache', () => {
    it('clears all cached data', () => {
      const recipes = [
        { id: 1 },
      ] as Partial<RecipeInformation>[] as RecipeInformation[];
      useRecipeSuggestionsStore.getState().setCachedSuggestions('a', recipes);
      useRecipeSuggestionsStore.getState().setCachedSuggestions('b', recipes);
      useRecipeSuggestionsStore.getState().clearAllCache();
      expect(useRecipeSuggestionsStore.getState().cache).toEqual({});
    });
  });
});
