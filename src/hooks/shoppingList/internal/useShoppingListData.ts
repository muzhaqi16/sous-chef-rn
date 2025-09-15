import { useCallback, useMemo, useEffect } from 'react';
import { useGetShoppingListItemsQuery } from '#generated';
import { useStore } from '#store';

interface UseShoppingListDataOptions {
  onDataReceived?: (items: any[]) => void;
}

/**
 * Hook to handle GraphQL queries for shopping list items
 *
 * @param listId - The shopping list ID to fetch items for
 * @param options - Configuration options
 * @returns Query data, loading states, and refetch function
 */
export function useShoppingListData(
  listId: string | null,
  options: UseShoppingListDataOptions = {},
) {
  const { onDataReceived } = options;
  const user = useStore(state => state.user);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isLoggedOut = !user;

  // Should skip queries if no valid listId or user is logging out
  const shouldSkip = !listId || listId === '' || isLoggedOut || isLoggingOut;

  // Cache-first query for immediate results
  const {
    data: cachedData,
    loading: cacheLoading,
    error: cacheError,
  } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId || '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-first',
    notifyOnNetworkStatusChange: false,
    errorPolicy: 'all', // Return both data and errors
  });

  // Network query for fresh data
  const {
    data: networkData,
    loading: networkLoading,
    error: networkError,
    refetch: networkRefetch,
  } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId || '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all',
  });

  const items = useMemo(() => {
    // Prefer network data, fall back to cached data
    if (networkData?.shoppingListItems) {
      return networkData.shoppingListItems;
    }
    if (cachedData?.shoppingListItems) {
      return cachedData.shoppingListItems;
    }
    return [];
  }, [networkData?.shoppingListItems, cachedData?.shoppingListItems]);

  // Loading states
  const isInitialLoading = cacheLoading && !cachedData?.shoppingListItems;
  const isRefreshing = networkLoading && !!cachedData?.shoppingListItems;

  // Enhanced refetch function
  const refetch = useCallback(async () => {
    if (shouldSkip) {
      console.warn('Cannot refetch: invalid listId or user logged out');
      return;
    }

    try {
      const result = await networkRefetch();
      if (result.data?.shoppingListItems && !isLoggedOut && !isLoggingOut) {
        onDataReceived?.(result.data.shoppingListItems);
      }
      return result;
    } catch (error) {
      console.error('Refetch failed:', error);
      throw error;
    }
  }, [networkRefetch, shouldSkip, onDataReceived, isLoggedOut, isLoggingOut]);

  // Combine errors (prefer network errors as they're more recent)
  const error = networkError || cacheError;

  return {
    items,
    loading: isInitialLoading,
    refreshing: isRefreshing,
    refetch,
    error,
  };
}
