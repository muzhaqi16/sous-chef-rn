import { useMemo } from 'react';
import { useMySavedRecipesQuery } from '#generated';

/**
 * Hook to extract unique folder names from user's saved recipes
 * Returns a list of folder names for filtering/selection in UI
 */
export function useRecipeFolders() {
  const { data, loading, error, refetch } = useMySavedRecipesQuery({
    fetchPolicy: 'cache-first',
  });

  const folders = useMemo<string[]>(() => {
    if (!data?.mySavedRecipes) return [];

    // Extract unique non-null folder names
    const folderSet = new Set<string>();
    data.mySavedRecipes.forEach(savedRecipe => {
      if (savedRecipe.folder) {
        folderSet.add(savedRecipe.folder);
      }
    });

    // Return sorted array of folder names
    return Array.from(folderSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    );
  }, [data?.mySavedRecipes]);

  return {
    folders,
    loading,
    error,
    refetch,
    totalRecipes: data?.mySavedRecipes?.length ?? 0,
  };
}
