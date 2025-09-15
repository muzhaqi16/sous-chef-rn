import {storage} from './mmkv';

const SHOPPING_LISTS_CACHE_KEY = 'shopping_lists';
const SHOPPING_LIST_ITEMS_PREFIX = 'shopping_list_items_';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface CachedShoppingListsData {
  lists: any[];
  timestamp: number;
  version: number;
  userId: string;
}

export interface CachedShoppingListItemsData {
  items: any[];
  timestamp: number;
  version: number;
  shoppingListId: string;
}

export const shoppingListStorage = {
  // ============================================================================
  // SHOPPING LISTS (metadata) CACHE OPERATIONS
  // ============================================================================

  /**
   * Cache user's shopping lists with timestamp and version
   */
  setShoppingLists: (lists: any[], userId?: string): void => {
    try {
      const cacheData: CachedShoppingListsData = {
        lists,
        timestamp: Date.now(),
        version: 1,
        userId: userId || 'default',
      };
      storage.set(SHOPPING_LISTS_CACHE_KEY, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Failed to cache shopping lists:', error);
    }
  },

  /**
   * Get cached shopping lists if valid, otherwise return null
   */
  getShoppingLists: (): any[] | null => {
    try {
      const cached = storage.getString(SHOPPING_LISTS_CACHE_KEY);
      if (!cached) return null;

      const parsed: CachedShoppingListsData = JSON.parse(cached);
      
      // Validate cache structure
      if (!parsed.lists || !Array.isArray(parsed.lists)) {
        console.warn('Invalid shopping lists cache structure');
        shoppingListStorage.clearShoppingListsCache();
        return null;
      }

      return parsed.lists;
    } catch (error) {
      console.warn('Failed to read shopping lists cache:', error);
      shoppingListStorage.clearShoppingListsCache();
      return null;
    }
  },

  /**
   * Check if shopping lists cache is still fresh
   */
  isShoppingListsCacheFresh: (): boolean => {
    try {
      const cached = storage.getString(SHOPPING_LISTS_CACHE_KEY);
      if (!cached) return false;

      const parsed: CachedShoppingListsData = JSON.parse(cached);
      return Date.now() - parsed.timestamp < CACHE_EXPIRY_MS;
    } catch (error) {
      return false;
    }
  },

  /**
   * Update a single shopping list in the cache
   */
  updateShoppingList: (updatedList: any): void => {
    const currentLists = shoppingListStorage.getShoppingLists();
    if (!currentLists) return;

    const listIndex = currentLists.findIndex(list => list.id === updatedList.id);
    if (listIndex !== -1) {
      // Update existing list
      currentLists[listIndex] = {...currentLists[listIndex], ...updatedList};
    } else {
      // Add new list
      currentLists.push(updatedList);
    }

    shoppingListStorage.setShoppingLists(currentLists);
  },

  /**
   * Remove a shopping list from the cache
   */
  removeShoppingList: (listId: string): void => {
    const currentLists = shoppingListStorage.getShoppingLists();
    if (!currentLists) return;

    const filteredLists = currentLists.filter(list => list.id !== listId);
    shoppingListStorage.setShoppingLists(filteredLists);

    // Also clear the items cache for this list
    shoppingListStorage.clearShoppingListItemsCache(listId);
  },

  /**
   * Clear shopping lists cache
   */
  clearShoppingListsCache: (): void => {
    try {
      storage.delete(SHOPPING_LISTS_CACHE_KEY);
    } catch (error) {
      console.warn('Failed to clear shopping lists cache:', error);
    }
  },

  // ============================================================================
  // SHOPPING LIST ITEMS CACHE OPERATIONS
  // ============================================================================

  /**
   * Cache shopping list items with timestamp and version
   */
  setShoppingListItems: (shoppingListId: string, items: any[]): void => {
    try {
      const cacheData: CachedShoppingListItemsData = {
        items,
        timestamp: Date.now(),
        version: 1,
        shoppingListId,
      };
      storage.set(`${SHOPPING_LIST_ITEMS_PREFIX}${shoppingListId}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache shopping list items for ${shoppingListId}:`, error);
    }
  },

  /**
   * Get cached shopping list items if valid, otherwise return null
   */
  getShoppingListItems: (shoppingListId: string): any[] | null => {
    try {
      const cached = storage.getString(`${SHOPPING_LIST_ITEMS_PREFIX}${shoppingListId}`);
      if (!cached) return null;

      const parsed: CachedShoppingListItemsData = JSON.parse(cached);
      
      // Validate cache structure
      if (!parsed.items || !Array.isArray(parsed.items)) {
        console.warn(`Invalid cache structure for shopping list ${shoppingListId}`);
        shoppingListStorage.clearShoppingListItemsCache(shoppingListId);
        return null;
      }

      return parsed.items;
    } catch (error) {
      console.warn(`Failed to read shopping list items cache for ${shoppingListId}:`, error);
      shoppingListStorage.clearShoppingListItemsCache(shoppingListId);
      return null;
    }
  },

  /**
   * Check if cached shopping list items are still fresh
   */
  isShoppingListItemsCacheFresh: (shoppingListId: string): boolean => {
    try {
      const cached = storage.getString(`${SHOPPING_LIST_ITEMS_PREFIX}${shoppingListId}`);
      if (!cached) return false;

      const parsed: CachedShoppingListItemsData = JSON.parse(cached);
      return Date.now() - parsed.timestamp < CACHE_EXPIRY_MS;
    } catch (error) {
      return false;
    }
  },

  /**
   * Update a single item in the shopping list cache
   */
  updateShoppingListItem: (shoppingListId: string, updatedItem: any): void => {
    const currentItems = shoppingListStorage.getShoppingListItems(shoppingListId);
    if (!currentItems) return;

    const itemIndex = currentItems.findIndex(item => item.id === updatedItem.id);
    if (itemIndex !== -1) {
      // Update existing item
      currentItems[itemIndex] = {...currentItems[itemIndex], ...updatedItem};
    } else {
      // Add new item
      currentItems.push(updatedItem);
    }

    shoppingListStorage.setShoppingListItems(shoppingListId, currentItems);

    // Also update the list metadata cache with new item counts
    shoppingListStorage.updateListItemCounts(shoppingListId);
  },

  /**
   * Remove an item from the shopping list cache
   */
  removeShoppingListItem: (shoppingListId: string, itemId: string): void => {
    const currentItems = shoppingListStorage.getShoppingListItems(shoppingListId);
    if (!currentItems) return;

    const filteredItems = currentItems.filter(item => item.id !== itemId);
    shoppingListStorage.setShoppingListItems(shoppingListId, filteredItems);

    // Also update the list metadata cache with new item counts
    shoppingListStorage.updateListItemCounts(shoppingListId);
  },

  /**
   * Mark an item as purchased/unpurchased in the cache
   */
  markItemPurchased: (shoppingListId: string, itemId: string, isPurchased: boolean): void => {
    const currentItems = shoppingListStorage.getShoppingListItems(shoppingListId);
    if (!currentItems) return;

    const itemIndex = currentItems.findIndex(item => item.id === itemId);
    if (itemIndex !== -1) {
      currentItems[itemIndex] = {
        ...currentItems[itemIndex],
        isPurchased,
        purchaseDate: isPurchased ? new Date().toISOString() : null,
      };
      
      shoppingListStorage.setShoppingListItems(shoppingListId, currentItems);
      
      // Update the list metadata cache with new completion counts
      shoppingListStorage.updateListItemCounts(shoppingListId);
    }
  },

  /**
   * Update list metadata cache with current item counts
   */
  updateListItemCounts: (shoppingListId: string): void => {
    const items = shoppingListStorage.getShoppingListItems(shoppingListId);
    if (!items) return;

    const totalItems = items.length;
    const completedItems = items.filter(item => item.isPurchased).length;

    // Update the list in the lists cache
    const lists = shoppingListStorage.getShoppingLists();
    if (lists) {
      const listIndex = lists.findIndex(list => list.id === shoppingListId);
      if (listIndex !== -1) {
        lists[listIndex] = {
          ...lists[listIndex],
          totalItems,
          completedItems,
          isCompleted: completedItems > 0 && completedItems === totalItems,
        };
        shoppingListStorage.setShoppingLists(lists);
      }
    }
  },

  /**
   * Clear cache for a specific shopping list's items
   */
  clearShoppingListItemsCache: (shoppingListId: string): void => {
    try {
      storage.delete(`${SHOPPING_LIST_ITEMS_PREFIX}${shoppingListId}`);
    } catch (error) {
      console.warn(`Failed to clear cache for shopping list ${shoppingListId}:`, error);
    }
  },

  // ============================================================================
  // BULK OPERATIONS
  // ============================================================================

  /**
   * Clear all shopping list caches (both lists and items)
   */
  clearAllShoppingListCaches: (): void => {
    try {
      // Clear shopping lists metadata cache
      storage.delete(SHOPPING_LISTS_CACHE_KEY);

      // Clear all shopping list items caches
      const allKeys = storage.getAllKeys();
      const shoppingListItemKeys = allKeys.filter(key => 
        key.startsWith(SHOPPING_LIST_ITEMS_PREFIX)
      );
      
      shoppingListItemKeys.forEach(key => {
        storage.delete(key);
      });
    } catch (error) {
      console.warn('Failed to clear all shopping list caches:', error);
    }
  },

  /**
   * Get cache metadata for debugging
   */
  getCacheInfo: (shoppingListId?: string) => {
    if (shoppingListId) {
      // Get info for specific shopping list items
      try {
        const cached = storage.getString(`${SHOPPING_LIST_ITEMS_PREFIX}${shoppingListId}`);
        if (!cached) return null;

        const parsed: CachedShoppingListItemsData = JSON.parse(cached);
        return {
          type: 'items',
          shoppingListId,
          itemCount: parsed.items?.length || 0,
          timestamp: parsed.timestamp,
          age: Date.now() - parsed.timestamp,
          isFresh: Date.now() - parsed.timestamp < CACHE_EXPIRY_MS,
          version: parsed.version,
        };
      } catch (error) {
        return null;
      }
    } else {
      // Get info for shopping lists metadata
      try {
        const cached = storage.getString(SHOPPING_LISTS_CACHE_KEY);
        if (!cached) return null;

        const parsed: CachedShoppingListsData = JSON.parse(cached);
        return {
          type: 'lists',
          listCount: parsed.lists?.length || 0,
          timestamp: parsed.timestamp,
          age: Date.now() - parsed.timestamp,
          isFresh: Date.now() - parsed.timestamp < CACHE_EXPIRY_MS,
          version: parsed.version,
          userId: parsed.userId,
        };
      } catch (error) {
        return null;
      }
    }
  },

  /**
   * Get statistics for all cached shopping lists
   */
  getAllCacheStats: () => {
    try {
      const allKeys = storage.getAllKeys();
      const shoppingListItemKeys = allKeys.filter(key => 
        key.startsWith(SHOPPING_LIST_ITEMS_PREFIX)
      );

      const stats = {
        totalLists: 0,
        totalCachedItemsLists: shoppingListItemKeys.length,
        totalCachedItems: 0,
        oldestCache: Date.now(),
        newestCache: 0,
        freshCaches: 0,
      };

      // Check lists metadata cache
      const listsInfo = shoppingListStorage.getCacheInfo();
      if (listsInfo) {
        stats.totalLists = (listsInfo as any).listCount;
        if ((listsInfo as any).isFresh) stats.freshCaches++;
        stats.oldestCache = Math.min(stats.oldestCache, (listsInfo as any).timestamp);
        stats.newestCache = Math.max(stats.newestCache, (listsInfo as any).timestamp);
      }

      // Check each items cache
      shoppingListItemKeys.forEach(key => {
        const shoppingListId = key.replace(SHOPPING_LIST_ITEMS_PREFIX, '');
        const info = shoppingListStorage.getCacheInfo(shoppingListId);
        if (info) {
          stats.totalCachedItems += (info as any).itemCount;
          if ((info as any).isFresh) stats.freshCaches++;
          stats.oldestCache = Math.min(stats.oldestCache, (info as any).timestamp);
          stats.newestCache = Math.max(stats.newestCache, (info as any).timestamp);
        }
      });

      return stats;
    } catch (error) {
      console.warn('Failed to get cache stats:', error);
      return null;
    }
  },
};