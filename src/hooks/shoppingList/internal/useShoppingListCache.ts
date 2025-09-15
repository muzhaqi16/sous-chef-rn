import {useState, useEffect, useCallback} from 'react';
import {shoppingListStorage} from '#/storage/shoppingListCache';
import {useStore} from '#store';

/**
 * Hook to manage MMKV caching for shopping list items
 * 
 * @param listId - The shopping list ID to cache items for
 * @returns Cache management functions and state
 */
export function useShoppingListCache(listId: string | null) {
  const user = useStore(state => state.user);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isLoggedOut = !user;

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
    if (!listId || isLoggedOut || isLoggingOut) {
      setOptimisticItems([]);
      setHasLoadedCache(false);
      return;
    }

    try {
      const cachedItems = shoppingListStorage.getShoppingListItems(listId);
      if (cachedItems && cachedItems.length > 0) {
        setOptimisticItems(cachedItems);
        setHasLoadedCache(true);
      } else {
        setOptimisticItems([]);
        setHasLoadedCache(false);
      }
    } catch (error) {
      console.error('Error loading cached items:', error);
      setOptimisticItems([]);
      setHasLoadedCache(false);
    }
  }, [listId, isLoggedOut, isLoggingOut]);

  // Update cache with new items
  const updateCache = useCallback((items: any[]) => {
    if (!listId || isLoggedOut || isLoggingOut) return;
    
    try {
      shoppingListStorage.setShoppingListItems(listId, items);
      setOptimisticItems(items);
    } catch (error) {
      console.error('Error updating cache:', error);
    }
  }, [listId, isLoggedOut, isLoggingOut]);

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