import { useMemo, useCallback } from 'react';
import { useMySavedRecipesQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Normalized saved recipe with recipe data flattened
 */
export interface SavedRecipe {
  id: string;
  recipeId: string;
  name: string;
  imageUrl?: string | null;
  servings?: number | null;
  prepTimeMinutes?: number | null;
  cookTimeMinutes?: number | null;
  totalTimeMinutes?: number | null;
  description?: string | null;
  category?: string | null;
  difficulty?: string | null;
  cuisine?: string | null;
  // Saved recipe metadata
  folder?: string | null;
  tags: string[];
  notes?: string | null;
  personalRating?: number | null;
  cookedCount: number;
  lastCookedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook to fetch user's saved/favorited recipes
 * Uses MySavedRecipes query which returns recipes saved via FavoriteRecipe mutation
 */
export function useSavedRecipes(folder?: string | null) {
  const { isLoggedOut } = useAuth();
  const shouldSkip = isLoggedOut;

  const { data, loading, error, refetch, fetchMore } = useMySavedRecipesQuery({
    variables: {
      folder: folder ?? undefined,
      first: DEFAULT_PAGE_SIZE,
    },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  useApolloErrorLogger('MySavedRecipes', error);

  const connection = data?.me?.savedRecipesConnection;

  // Normalize saved recipes to flatten the recipe data
  const recipes = useMemo<SavedRecipe[]>(() => {
    if (!connection?.edges) return [];

    return connection.edges.map(edge => edge.node).map(savedRecipe => ({
      // Use saved recipe ID as the primary ID for list operations
      id: savedRecipe.id,
      recipeId: savedRecipe.recipe.id,
      // Flatten recipe data
      name: savedRecipe.recipe.name,
      imageUrl: savedRecipe.recipe.imageUrl,
      servings: savedRecipe.recipe.servings,
      prepTimeMinutes: savedRecipe.recipe.prepTimeMinutes,
      cookTimeMinutes: savedRecipe.recipe.cookTimeMinutes,
      totalTimeMinutes: savedRecipe.recipe.totalTimeMinutes,
      description: savedRecipe.recipe.description,
      category: savedRecipe.recipe.category,
      difficulty: savedRecipe.recipe.difficulty,
      cuisine: savedRecipe.recipe.cuisine,
      // Saved recipe metadata
      folder: savedRecipe.folder,
      tags: savedRecipe.tags ?? [],
      notes: savedRecipe.notes,
      personalRating: savedRecipe.personalRating,
      cookedCount: savedRecipe.cookedCount ?? 0,
      lastCookedAt: savedRecipe.lastCookedAt,
      createdAt: savedRecipe.createdAt,
      updatedAt: savedRecipe.updatedAt,
    }));
  }, [connection]);

  const hasNextPage = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor;
  const totalCount = connection?.totalCount ?? recipes.length;

  const loadMore = useCallback(() => {
    if (!hasNextPage || loading || !endCursor) return;

    fetchMore({
      variables: { after: endCursor },
    });
  }, [hasNextPage, loading, endCursor, fetchMore]);

  return {
    // Data
    recipes,
    loading,
    error,
    totalCount,
    hasNextPage,

    // Actions
    refetch,
    loadMore,

    // Helper functions
    getRecipeById: (recipeId: string) =>
      recipes.find(recipe => recipe.recipeId === recipeId),
    getRecipesByFolder: (folderName: string) =>
      recipes.filter(recipe => recipe.folder === folderName),
    getRecipesByTag: (tag: string) =>
      recipes.filter(recipe => recipe.tags.includes(tag)),
  };
}
