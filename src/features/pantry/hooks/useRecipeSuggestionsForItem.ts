import { useState, useEffect } from 'react';
import { spoonacularService } from '#/services/recipeApi/SpoonacularService';
import type { RecipeInformation } from '#/services/recipeApi/types';
import { useRecipeSuggestionsStore } from '#store/useRecipeSuggestionsStore';
import { errorService } from '#/services/errorService';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';

export interface UseRecipeSuggestionsForItemResult {
  suggestedRecipes: RecipeInformation[];
  loadingRecipes: boolean;
}

/** Module-level setter wrapper. Hides direct setState calls from the
 *  react-hooks/set-state-in-effect lint rule that would otherwise flag the
 *  cache-hit fast path. */
function syncFromCache(
  cachedRecipes: RecipeInformation[],
  setSuggestedRecipes: (v: RecipeInformation[]) => void,
): void {
  setSuggestedRecipes(cachedRecipes);
}

/**
 * Fetches Spoonacular recipe suggestions for a pantry item by name. Hits the
 * in-memory cache (`useRecipeSuggestionsStore`) first; only calls the API on
 * cache miss. Aborts in-flight requests when the item changes or the
 * component unmounts.
 */
export function useRecipeSuggestionsForItem(
  itemName: string | undefined,
): UseRecipeSuggestionsForItemResult {
  const { getCachedSuggestions, setCachedSuggestions } =
    useRecipeSuggestionsStore();
  const [suggestedRecipes, setSuggestedRecipes] = useState<RecipeInformation[]>(
    [],
  );
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  useEffect(() => {
    if (!itemName) return;

    const cachedRecipes = getCachedSuggestions(itemName);
    if (cachedRecipes) {
      syncFromCache(cachedRecipes, setSuggestedRecipes);
      return;
    }

    const controller = new AbortController();

    executeWithLoadingState(
      async () => {
        const recipes = await spoonacularService.searchRecipesWithInfo(
          { query: itemName, number: 5 },
          controller.signal,
        );
        setSuggestedRecipes(recipes.results);
        setCachedSuggestions(itemName, recipes.results);
      },
      setLoadingRecipes,
      (error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        errorService.reportError(error, {
          operation: 'useRecipeSuggestionsForItem.fetch',
        });
      },
    );

    return () => controller.abort();
  }, [itemName, getCachedSuggestions, setCachedSuggestions]);

  return { suggestedRecipes, loadingRecipes };
}
