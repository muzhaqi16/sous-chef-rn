import {useState, useEffect, useCallback} from 'react';
import {shoppingListStorage} from '#/storage/shoppingListCache';
import {useAuth} from '#hooks/auth/useAuth';

/**
 * Hook to manage MMKV caching for shopping list items
 * 
 * @param listId - The shopping list ID to cache items for
 * @returns Cache management functions and state
 */
export function useShoppingListCache(listId: string | null) {
  const { isLoggingOut, isLoggedOut, canAttemptQueries } = useAuth();

  const [optimisticItems, setOptimisticItems] = useState<any[]>([]);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);

  // Clear cache immediately on logout
  useEffect(() => {
    if (isLoggedOut) {
      setOptimisticItems([]);
      setHasLoadedCache(false);
    }
  }, [isLoggedOut]);

  // Load cached items when listId changes
  useEffect(() => {
    if (!listId || !canAttemptQueries) {
      setOptimisticItems([]);
      setHasLoadedCache(false);
      return;
    }

    try {
      const cachedItems = shoppingListStorage.getShoppingListItems(listId);
      if (cachedItems !== null) {
        // Cache exists (even if empty array), so we have loaded cache
        setOptimisticItems(cachedItems);
        setHasLoadedCache(true);
      } else {
        // No cache exists, start with empty state
        setOptimisticItems([]);
        setHasLoadedCache(false);
      }
    } catch (error) {
      console.error('Error loading cached items:', error);
      setOptimisticItems([]);
      setHasLoadedCache(false);
    }
  }, [listId, canAttemptQueries]);

  // Update cache with new items
  const updateCache = useCallback((items: any[]) => {
    if (!listId || !canAttemptQueries) return;
    
    try {
      shoppingListStorage.setShoppingListItems(listId, items);
      setOptimisticItems(items);
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  }, [listId, canAttemptQueries]);

  // Clear cache for current list
  const clearCache = useCallback(() => {
    if (!listId) return;
    
    try {
      shoppingListStorage.clearShoppingListItemsCache(listId);
      setOptimisticItems([]);
      setHasLoadedCache(false);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }, [listId]);

  // Get cache info
  const getCacheInfo = useCallback(() => {
    if (!listId) return null;
    
    try {
      return shoppingListStorage.getCacheInfo(listId);
    } catch (error) {
      console.error('Error getting cache info:', error);
      return null;
    }
  }, [listId]);

  return {
    optimisticItems,
    hasLoadedCache,
    updateCache,
    clearCache,
    getCacheInfo,
  };
}