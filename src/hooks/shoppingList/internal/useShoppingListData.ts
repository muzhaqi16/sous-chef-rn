import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import { useGetShoppingListItemsQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { shoppingListStorage } from '#/storage/shoppingListCache';

// Debouncing mechanism to prevent too many retry attempts
const RETRY_DEBOUNCE_MS = 2000; // 2 second debounce

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
  const { user, accessToken, isLoggingOut, isLoggedOut, canAttemptQueries } = useAuth();

  // Local state - MMKV is source of truth
  const [items, setItems] = useState<any[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);
  const lastRetryAttempt = useRef(0);

  // Load from MMKV immediately when listId changes
  useEffect(() => {
    if (listId && !isLoggedOut) {
      const cached = shoppingListStorage.getShoppingListItems(listId);
      if (cached !== null) {
        // Cache exists (even if empty array), so we have loaded cache
        setItems(cached);
        setHasLoadedCache(true);
      } else {
        // No cache exists, start with empty state
        setItems([]);
        setHasLoadedCache(false);
      }
    } else {
      setItems([]);
      setHasLoadedCache(false);
    }
  }, [listId, isLoggedOut]);

  // Should skip queries if no valid listId or user is logging out
  const shouldSkip = !listId || listId === '' || !canAttemptQueries;

  // Use cache-first for initial load, then network updates via subscription
  const fetchPolicy = hasLoadedCache ? 'cache-first' : 'cache-and-network';

  // Single query with adaptive fetch policy
  const {
    data: queryData,
    loading,
    error: queryError,
    refetch: networkRefetch,
  } = useGetShoppingListItemsQuery({
    variables: { shoppingListId: listId || '' },
    skip: shouldSkip,
    fetchPolicy,
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'all', // Return both data and errors
  });

  // Handle the completed logic with useEffect
  useEffect(() => {
    if (queryData?.shoppingListItems && listId) {
      // Update MMKV (source of truth)
      shoppingListStorage.setShoppingListItems(listId, queryData.shoppingListItems);
      // Update local state
      setItems(queryData.shoppingListItems);
      // Notify callback
      onDataReceived?.(queryData.shoppingListItems);
    }
  }, [queryData, listId, onDataReceived]);

  // Loading states
  const isInitialLoading = loading && !hasLoadedCache && items.length === 0;
  const isRefreshing = loading && (hasLoadedCache || items.length > 0);

  // Enhanced refetch function
  const refetch = useCallback(async () => {
    if (shouldSkip) {
      console.warn('Cannot refetch: invalid listId or user not authenticated');
      return;
    }

    try {
      const result = await networkRefetch();
      return result;
    } catch (error) {
      console.error('Refetch failed:', error);
      throw error;
    }
  }, [networkRefetch, shouldSkip]);

  // Simplified retry mechanism with debouncing - only retry when user becomes available after token refresh
  useEffect(() => {
    if (user && accessToken && !queryData?.shoppingListItems && !loading && hasLoadedCache === false) {
      const now = Date.now();
      if (now - lastRetryAttempt.current > RETRY_DEBOUNCE_MS) {
        lastRetryAttempt.current = now;
        console.log('Retrying shopping list data fetch after token refresh');
        networkRefetch();
      }
    }
  }, [user, accessToken, queryData?.shoppingListItems, loading, hasLoadedCache, networkRefetch]);

  return {
    items,
    loading: isInitialLoading,
    refreshing: isRefreshing,
    refetch,
    error: queryError,
    hasLoadedCache,
  };
}
