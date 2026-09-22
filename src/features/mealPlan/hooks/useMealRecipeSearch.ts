import { useRef, useState } from 'react';
import { spoonacularService } from '#/services/spoonacular/SpoonacularService';
import type { SearchRecipesResult } from '#/services/spoonacular/types';
import {
  transformRecipeForDisplay,
  type TransformedRecipeItem,
} from '#domain/recipeTransform';
import {
  useRecipeCacheStore,
  textSearchCacheKey,
} from '#features/recipes/store/useRecipeCacheStore';
import { executeAsyncWithCleanup } from '#/utils/finallyHelpers';

const MIN_QUERY_LENGTH = 3;

/** Cache-first: a text search's 24h entry answers before the network does. */
function searchWithCache(
  query: string,
  onResults: (results: TransformedRecipeItem[]) => void,
  setSearching: (searching: boolean) => void,
  signal: AbortSignal,
) {
  const cacheKey = textSearchCacheKey(query);
  const cacheStore = useRecipeCacheStore.getState();
  const cached = cacheStore.getCached(cacheKey);

  if (cached) {
    // A text-search key only ever holds text-search results.
    onResults(
      cached.results.map(r =>
        transformRecipeForDisplay(r as SearchRecipesResult),
      ),
    );
    setSearching(false);
    return;
  }

  setSearching(true);

  void executeAsyncWithCleanup(
    async () => {
      const response = await spoonacularService.searchRecipesWithInfo(
        { query, number: 10 },
        signal,
      );

      if (!signal.aborted) {
        cacheStore.setCached(cacheKey, response.results);
        onResults(response.results.map(transformRecipeForDisplay));
      }
    },
    () => {
      if (!signal.aborted) setSearching(false);
    },
    () => {
      // Saved recipes still show; the Spoonacular section stays empty.
    },
  );
}

/**
 * The add-meal sheet's Spoonacular search: a query shorter than three
 * characters clears the results, and a newer query aborts the one in flight.
 */
export const useMealRecipeSearch = () => {
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
    searchWithCache(trimmed, setResults, setSearching, controller.signal);
  };

  return { results, searching, search, clear };
};
