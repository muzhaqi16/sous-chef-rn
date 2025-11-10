import { useMemo, useCallback } from 'react';
import { useMyRecipesQuery, RecipeCategory, Difficulty } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { normalizeRecipes } from '#/utils/connectionUtils';

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

  // Query recipes with Connection pattern
  const { data, loading, error, refetch, fetchMore } = useMyRecipesQuery({
    variables: {
      first: 25, // Initial page size
      category: filters?.category,
      difficulty: filters?.difficulty,
    },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  // Normalize recipes data to flatten Connection pattern and preserve pagination metadata
  const normalizedRecipes = useMemo(
    () => normalizeRecipes(data?.recipes),
    [data?.recipes],
  );

  const recipes = useMemo(
    () => normalizedRecipes?.recipes || [],
    [normalizedRecipes],
  );

  // Pagination state
  const hasMore = normalizedRecipes?.pageInfo?.hasNextPage || false;
  const endCursor = normalizedRecipes?.pageInfo?.endCursor;
  const totalCount = normalizedRecipes?.totalCount || 0;

  // Load more handler for infinite scroll
  const loadMore = useCallback(async () => {
    if (!hasMore || loading || !endCursor) {
      return;
    }

    try {
      await fetchMore({
        variables: {
          cursor: endCursor,
        },
      });
    } catch (error) {
      console.error('Failed to load more recipes:', error);
      // Fail silently - user can try scrolling again
    }
  }, [hasMore, loading, endCursor, fetchMore]);

  return {
    // Data
    recipes,
    loading,
    error,
    totalCount,

    // Pagination
    loadMore,
    hasMore,
    isLoadingMore: loading && recipes.length > 0,

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
