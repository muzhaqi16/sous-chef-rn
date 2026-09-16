import { useQuery } from '@apollo/client/react';
import { SavedRecipeFoldersDocument } from '#features/recipes/graphql/recipe.generated';

/**
 * Hook to get folder names for saved recipes
 * Uses the dedicated savedRecipeFolders query for efficiency
 */
export function useRecipeFolders() {
  const { data, refetch } = useQuery(SavedRecipeFoldersDocument, {});

  return {
    folders: data?.savedRecipeFolders ?? [],
    refetch,
  };
}
