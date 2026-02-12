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

  const savedRecipes = useMemo(
    () => data?.mySavedRecipes?.edges?.map(e => e.node) ?? [],
    [data?.mySavedRecipes],
  );

  const tags = useMemo<string[]>(() => {
    if (savedRecipes.length === 0) return [];

    // Extract unique tags from all saved recipes
    const tagSet = new Set<string>();
    savedRecipes.forEach(savedRecipe => {
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
  }, [savedRecipes]);

  // Count recipes per tag for potential display
  const tagCounts = useMemo<Record<string, number>>(() => {
    if (savedRecipes.length === 0) return {};

    const counts: Record<string, number> = {};
    savedRecipes.forEach(savedRecipe => {
      if (savedRecipe.tags && savedRecipe.tags.length > 0) {
        savedRecipe.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });

    return counts;
  }, [savedRecipes]);

  return {
    tags,
    tagCounts,
    loading,
    error,
    refetch,
  };
}
