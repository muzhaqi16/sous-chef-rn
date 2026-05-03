import { useQuery } from '@apollo/client/react';
import { SavedRecipeFoldersDocument } from '#features/recipes/graphql/recipe.generated';

/**
 * Hook to get folder names for saved recipes
 * Uses the dedicated savedRecipeFolders query for efficiency
 */
export function useRecipeFolders() {
  const { data, loading, error, refetch } = useQuery(
    SavedRecipeFoldersDocument,
    {},
  );

  return {
    folders: data?.savedRecipeFolders ?? [],
    loading,
    error,
    refetch,
  };
}
