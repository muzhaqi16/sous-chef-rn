import { useMySavedRecipesQuery } from '#generated';

/**
 * Hook to extract unique tags from user's saved recipes
 * Returns a list of tags for autocomplete suggestions and filtering
 */
export function useRecipeTags() {
  const { data, loading, error, refetch } = useMySavedRecipesQuery({
    fetchPolicy: 'cache-first',
  });

  const savedRecipes =
    data?.me?.savedRecipesConnection?.edges?.map(e => e.node) ?? [];

  // Extract unique tags from all saved recipes
  let tags: string[] = [];
  if (savedRecipes.length > 0) {
    const tagSet = new Set<string>();
    savedRecipes.forEach(savedRecipe => {
      if (savedRecipe.tags && savedRecipe.tags.length > 0) {
        savedRecipe.tags.forEach(tag => {
          tagSet.add(tag);
        });
      }
    });

    // Return sorted array of unique tags
    tags = Array.from(tagSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }

  // Count recipes per tag for potential display
  let tagCounts: Record<string, number> = {};
  if (savedRecipes.length > 0) {
    const counts: Record<string, number> = {};
    savedRecipes.forEach(savedRecipe => {
      if (savedRecipe.tags && savedRecipe.tags.length > 0) {
        savedRecipe.tags.forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      }
    });
    tagCounts = counts;
  }

  return {
    tags,
    tagCounts,
    loading,
    error,
    refetch,
  };
}
