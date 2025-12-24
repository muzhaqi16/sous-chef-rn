import { useSavedRecipeFoldersQuery } from '#generated';

/**
 * Hook to get folder names for saved recipes
 * Uses the dedicated savedRecipeFolders query for efficiency
 */
export function useRecipeFolders() {
  const { data, loading, error, refetch } = useSavedRecipeFoldersQuery({
    fetchPolicy: 'cache-and-network',
  });

  return {
    folders: data?.savedRecipeFolders ?? [],
    loading,
    error,
    refetch,
  };
}
