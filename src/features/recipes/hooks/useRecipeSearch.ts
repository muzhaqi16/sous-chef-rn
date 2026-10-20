import { useRef, useState } from 'react';
import { useApolloClient } from '@apollo/client/react';
import type { RecipeFilters } from '#features/recipes/utils/recipeFilterMaps';
import type {
  RecipeRow,
  SearchedRecipe,
} from '#features/recipes/utils/recipeRows';
import { executeWithLoadingState } from '#/utils/finallyHelpers';
import {
  EMPTY_PAGINATION,
  executeRecipeIngredientSearch,
  executeRecipeLoadMore,
  executeRecipeTextSearch,
  type RecipeSearchDocument,
  type SearchPagination,
} from '#features/recipes/utils/recipeSearchPaging';

/**
 * Recipe search over the API and Spoonacular together. The caller passes its
 * own `searchRecipes` document, so the rows carry its cards' fields, and
 * presents each search's outcome itself.
 */
export function useRecipeSearch<TNode extends SearchedRecipe>(
  document: RecipeSearchDocument<TNode>,
) {
  const client = useApolloClient();
  // Each search captures it and commits only while it is still current, so a
  // newer search or a clear supersedes one in flight.
  const generationRef = useRef(0);
  const [query, setQuery] = useState('');
  const [performed, setPerformed] = useState(false);
  const [loading, setLoading] = useState(false);
  // Drops re-entrant load-mores: onEndReached fires again before a page lands.
  const [loadingMore, setLoadingMore] = useState(false);
  // Rows and cursors are ONE atom so a load-more commits both together; a
  // changed pagination identity tells it a new search replaced the state.
  const [results, setResults] = useState<{
    rows: RecipeRow<TNode>[];
    pagination: SearchPagination;
  }>({ rows: [], pagination: EMPTY_PAGINATION });
  const { pagination } = results;

  const setRows = (rows: RecipeRow<TNode>[]) => {
    setResults(prev => ({ ...prev, rows }));
  };
  const setPagination = (next: SearchPagination) => {
    setResults(prev => ({ ...prev, pagination: next }));
  };
  const supersede = () => {
    generationRef.current += 1;
    const generation = generationRef.current;
    return () => generation === generationRef.current;
  };

  const search = (text: string, filters: RecipeFilters) => {
    setQuery(text);
    return executeRecipeTextSearch(document, text, filters, client, {
      setLoading,
      setPerformed,
      setRows,
      setPagination,
      isCurrent: supersede(),
    });
  };

  // One Spoonacular call with no pages and no filters.
  const searchByIngredients = (ingredients: readonly string[]) => {
    setQuery('');
    setPagination(EMPTY_PAGINATION);
    return executeRecipeIngredientSearch(ingredients.join(','), {
      setLoading,
      setPerformed,
      setRows,
      isCurrent: supersede(),
    });
  };

  // More remains while EITHER source still has a page.
  const hasMore =
    pagination.localHasNextPage ||
    pagination.spoonacularOffset < pagination.spoonacularTotal;

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    const captured = pagination;
    await executeWithLoadingState(async () => {
      const page = await executeRecipeLoadMore(document, captured, client);
      if (!page) return;
      // A new search or clear mid-flight replaced the pagination; this page
      // belongs to the old query.
      setResults(prev =>
        prev.pagination === captured
          ? {
              rows: [...prev.rows, ...page.rows],
              pagination: page.nextPagination,
            }
          : prev,
      );
    }, setLoadingMore);
  };

  const clear = () => {
    supersede();
    setQuery('');
    setPerformed(false);
    setResults({ rows: [], pagination: EMPTY_PAGINATION });
    // A search cleared mid-flight would otherwise leave loading stuck on.
    setLoading(false);
  };

  return {
    query,
    rows: results.rows,
    performed,
    loading,
    loadingMore,
    hasMore,
    search,
    searchByIngredients,
    loadMore,
    clear,
  };
}
