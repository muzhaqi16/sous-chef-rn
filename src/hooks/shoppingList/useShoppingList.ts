import {useMemo} from 'react';
import {useSearchableList} from '../useSearchableList';
import {
  useShoppingListValidation,
  useShoppingListCache,
  useShoppingListData,
  useShoppingListSubscription,
} from './internal';

/**
 * Main hook for managing shopping list items with caching, real-time updates, and search
 * 
 * @param listId - The shopping list ID to fetch items for
 * @returns Object containing items, loading states, search functionality, and refetch method
 */
export function useShoppingList(listId: string | null) {
  // Validate that the listId belongs to the current user
  const {isValid: isValidListId, safeListId} = useShoppingListValidation(listId);
  
  // Handle caching logic
  const {
    optimisticItems,
    hasLoadedCache,
    updateCache,
    clearCache,
  } = useShoppingListCache(safeListId);
  
  // Handle GraphQL queries and data fetching
  const {
    items: queryItems,
    loading: queryLoading,
    refreshing: queryRefreshing,
    refetch: queryRefetch,
    error: queryError,
  } = useShoppingListData(safeListId, {
    onDataReceived: updateCache,
  });
  
  // Handle real-time subscriptions
  useShoppingListSubscription(safeListId, {
    onItemsChanged: updateCache,
    onError: (error) => {
      console.error('Subscription error:', error);
      // Refetch on subscription errors to ensure consistency
      queryRefetch();
    },
  });
  
  // Determine which data to use (query data takes precedence over cached data)
  const items = useMemo(() => {
    return queryItems.length > 0 ? queryItems : optimisticItems;
  }, [queryItems, optimisticItems]);
  
  // Add search functionality
  const {query, setQuery, filtered: searchedItems} = useSearchableList(
    items,
    (item, searchQuery) =>
      !!item.itemName && item.itemName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Loading states
  const isInitialLoading = queryLoading && !hasLoadedCache && items.length === 0;
  const isRefreshing = queryRefreshing && (items.length > 0 || hasLoadedCache);
  
  // Enhanced refetch that clears cache on error
  const refetch = async () => {
    if (!safeListId) return;
    
    try {
      return await queryRefetch();
    } catch (error) {
      console.error('Refetch failed, clearing cache:', error);
      clearCache();
      throw error;
    }
  };
  
  return {
    // Data
    items: searchedItems,
    
    // Search
    query,
    setQuery,
    
    // Loading states
    loading: isInitialLoading,
    refreshing: isRefreshing,
    
    // Cache info
    hasLoadedCache,
    
    // Actions
    refetch,
    
    // Validation
    isValidList: isValidListId,
    
    // Error state
    error: queryError,
  };
}