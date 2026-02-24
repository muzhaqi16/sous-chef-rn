import { useMemo } from 'react';
import { useMyRecipesQuery, RecipeCategory, Difficulty } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { normalizeRecipes } from '#/utils/connectionUtils';
import { usePagination } from '#/hooks/utils/usePagination';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

export interface RecipeFilters {
  category?: RecipeCategory;
  difficulty?: Difficulty;
}

/**
 * Recipe management hook with cursor-based pagination
 * Uses Connection pattern for infinite scroll
 */
export function useRecipeManagement(filters?: RecipeFilters) {
  const { isLoggedOut } = useAuth();
  const shouldSkip = isLoggedOut;

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, fetches fresh in background
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders
  // - errorPolicy: 'all' returns cached data when network fails (offline graceful degradation)

  // Query recipes with Connection pattern
  const { data, loading, error, refetch, fetchMore } = useMyRecipesQuery({
    variables: {
      first: 25, // Initial page size
      category: filters?.category,
      difficulty: filters?.difficulty,
    },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  useApolloErrorLogger('MyRecipes', error);

  // Normalize recipes data to flatten Connection pattern and preserve pagination metadata
  const normalizedRecipes = useMemo(
    () => normalizeRecipes(data?.recipes),
    [data?.recipes],
  );

  const recipes = useMemo(
    () => normalizedRecipes?.recipes || [],
    [normalizedRecipes],
  );

  const totalCount = normalizedRecipes?.totalCount || 0;

  // Pagination using generic utility hook
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo: normalizedRecipes?.pageInfo,
    loading,
    itemCount: recipes.length,
    fetchMore,
    cursorVariableName: 'cursor',
  });

  return {
    // Data
    recipes,
    loading,
    error,
    totalCount,

    // Pagination
    loadMore,
    hasMore,
    isLoadingMore,

    // Actions
    refetch,

    // Helper functions
    getRecipeById: (recipeId: string) =>
      recipes.find(recipe => recipe.id === recipeId),
    getRecipesByCategory: (category: RecipeCategory) =>
      recipes.filter(recipe => recipe.category === category),
    getRecipesByDifficulty: (difficulty: Difficulty) =>
      recipes.filter(recipe => recipe.difficulty === difficulty),
  };
}
