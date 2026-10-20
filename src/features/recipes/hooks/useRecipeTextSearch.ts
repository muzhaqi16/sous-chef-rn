import { useRef, useState } from 'react';
import { transformRecipeForDisplay } from '#domain/recipeTransform';
import { useTranslation } from '#/i18n';
import { fetchSpoonacularTextPage } from '#features/recipes/utils/recipeSearchPaging';
import type { SpoonacularRecipe } from '#features/recipes/utils/recipeDisplayTransforms';
import { DEFAULT_FILTERS } from '#features/recipes/utils/recipeFilterMaps';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';

const MIN_QUERY_LENGTH = 3;

function runSearch(
  query: string,
  onResults: (results: SpoonacularRecipe[]) => void,
  setSearching: (searching: boolean) => void,
  signal: AbortSignal,
) {
  setSearching(true);
  void executeAsyncWithCleanup(
    async () => {
      const page = await fetchSpoonacularTextPage(
        query,
        DEFAULT_FILTERS,
        0,
        signal,
      );
      if (!signal.aborted) onResults(page.results);
    },
    () => {
      if (!signal.aborted) setSearching(false);
    },
    () => {
      // A failed search leaves the results empty; the caller's own list still shows.
    },
  );
}

/**
 * A first-page Spoonacular text search for pickers outside the Recipes tab: a
 * query shorter than three characters clears the results, and a newer query
 * aborts the one in flight.
 */
export const useRecipeTextSearch = () => {
  const { t } = useTranslation();
  // Kept as Spoonacular returned them: the copy is written below, while
  // rendering, so the rows follow a language change.
  const [found, setFound] = useState<SpoonacularRecipe[]>([]);
  const [searching, setSearching] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const clear = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setFound([]);
    setSearching(false);
  };

  const search = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      clear();
      return;
    }
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    runSearch(trimmed, setFound, setSearching, controller.signal);
  };

  const results = found.map(recipe => transformRecipeForDisplay(recipe, t));

  return { results, searching, search, clear };
};
