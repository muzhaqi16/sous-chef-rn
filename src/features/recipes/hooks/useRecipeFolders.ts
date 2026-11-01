import { useQuery } from '@apollo/client/react';
import { useDataState } from '#hooks/data/useDataState';
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
  const folders = data?.savedRecipeFolders ?? [];
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: folders.length === 0,
  });

  return {
    folders,
    /** Set while there may be folders the device does not hold. */
    unavailable:
      state === 'offline' || state === 'error'
        ? {
            state,
            onRetry: () => {
              void refetch();
            },
          }
        : undefined,
    refetch,
  };
}
