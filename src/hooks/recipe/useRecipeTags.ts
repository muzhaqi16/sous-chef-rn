import { useMemo } from 'react';
import { useMySavedRecipesQuery } from '#generated';

/**
 * Hook to extract unique tags from user's saved recipes
 * Returns a list of tags for autocomplete suggestions and filtering
 */
export function useRecipeTags() {
  const { data, loading, error, refetch } = useMySavedRecipesQuery({
    fetchPolicy: 'cache-first',
  });

  const tags = useMemo<string[]>(() => {
    if (!data?.mySavedRecipes) return [];

    // Extract unique tags from all saved recipes
    const tagSet = new Set<string>();
    data.mySavedRecipes.forEach(savedRecipe => {
      if (savedRecipe.tags && savedRecipe.tags.length > 0) {
        savedRecipe.tags.forEach(tag => {
          tagSet.add(tag);
        });
      }
    });

    // Return sorted array of unique tags
    return Array.from(tagSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [data?.mySavedRecipes]);

  // Count recipes per tag for potential display
  const tagCounts = useMemo<Record<string, number>>(() => {
    if (!data?.mySavedRecipes) return {};

    const counts: Record<string, number> = {};
    data.mySavedRecipes.forEach(savedRecipe => {
      if (savedRecipe.tags && savedRecipe.tags.length > 0) {
        savedRecipe.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    return counts;
  }, [data?.mySavedRecipes]);

  return {
    tags,
    tagCounts,
    loading,
    error,
    refetch,
  };
}
