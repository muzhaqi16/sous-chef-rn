import { useRef, useState } from 'react';
import {
  transformRecipeForDisplay,
  type TransformedRecipeItem,
} from '#domain/recipeTransform';
import { fetchSpoonacularTextPage } from '#features/recipes/utils/recipeSearchPaging';
import { DEFAULT_FILTERS } from '#features/recipes/utils/recipeFilterMaps';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';

const MIN_QUERY_LENGTH = 3;

function runSearch(
  query: string,
  onResults: (results: TransformedRecipeItem[]) => void,
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
      if (!signal.aborted)
        onResults(page.results.map(transformRecipeForDisplay));
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
  const [results, setResults] = useState<TransformedRecipeItem[]>([]);
  const [searching, setSearching] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const clear = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setResults([]);
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
    runSearch(trimmed, setResults, setSearching, controller.signal);
  };

  return { results, searching, search, clear };
};
