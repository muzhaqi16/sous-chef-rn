import {storage} from './mmkv';

const PANTRY_CACHE_PREFIX = 'pantry_items_';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface CachedPantryData {
  items: any[];
  timestamp: number;
  version: number;
  pantryId: string;
}

export const pantryStorage = {
  /**
   * Cache pantry items with timestamp and version
   */
  setPantryItems: (pantryId: string, items: any[]): void => {
    try {
      const cacheData: CachedPantryData = {
        items,
        timestamp: Date.now(),
        version: 1,
        pantryId,
      };
      storage.set(`${PANTRY_CACHE_PREFIX}${pantryId}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn(`Failed to cache pantry items for ${pantryId}:`, error);
    }
  },

  /**
   * Get cached pantry items if valid, otherwise return null
   */
  getPantryItems: (pantryId: string): any[] | null => {
    try {
      const cached = storage.getString(`${PANTRY_CACHE_PREFIX}${pantryId}`);
      if (!cached) return null;

      const parsed: CachedPantryData = JSON.parse(cached);
      
      // Validate cache structure
      if (!parsed.items || !Array.isArray(parsed.items)) {
        console.warn(`Invalid cache structure for pantry ${pantryId}`);
        pantryStorage.clearPantryCache(pantryId);
        return null;
      }

      return parsed.items;
    } catch (error) {
      console.warn(`Failed to read pantry cache for ${pantryId}:`, error);
      pantryStorage.clearPantryCache(pantryId);
      return null;
    }
  },

  /**
   * Check if cached data is still fresh
   */
  isCacheFresh: (pantryId: string): boolean => {
    try {
      const cached = storage.getString(`${PANTRY_CACHE_PREFIX}${pantryId}`);
      if (!cached) return false;

      const parsed: CachedPantryData = JSON.parse(cached);
      return Date.now() - parsed.timestamp < CACHE_EXPIRY_MS;
    } catch (error) {
      return false;
    }
  },

  /**
   * Update a single item in the cache
   */
  updateCachedItem: (pantryId: string, updatedItem: any): void => {
    const currentItems = pantryStorage.getPantryItems(pantryId);
    if (!currentItems) return;

    const itemIndex = currentItems.findIndex(item => item.id === updatedItem.id);
    if (itemIndex !== -1) {
      // Update existing item
      currentItems[itemIndex] = updatedItem;
    } else {
      // Add new item
      currentItems.push(updatedItem);
    }

    pantryStorage.setPantryItems(pantryId, currentItems);
  },

  /**
   * Remove an item from the cache
   */
  removeCachedItem: (pantryId: string, itemId: string): void => {
    const currentItems = pantryStorage.getPantryItems(pantryId);
    if (!currentItems) return;

    const filteredItems = currentItems.filter(item => item.id !== itemId);
    pantryStorage.setPantryItems(pantryId, filteredItems);
  },

  /**
   * Clear cache for a specific pantry
   */
  clearPantryCache: (pantryId: string): void => {
    try {
      storage.delete(`${PANTRY_CACHE_PREFIX}${pantryId}`);
    } catch (error) {
      console.warn(`Failed to clear cache for pantry ${pantryId}:`, error);
    }
  },

  /**
   * Clear all pantry caches
   */
  clearAllPantryCaches: (): void => {
    try {
      const allKeys = storage.getAllKeys();
      const pantryKeys = allKeys.filter(key => key.startsWith(PANTRY_CACHE_PREFIX));
      
      pantryKeys.forEach(key => {
        storage.delete(key);
      });
    } catch (error) {
      console.warn('Failed to clear all pantry caches:', error);
    }
  },

  /**
   * Get cache metadata for debugging
   */
  getCacheInfo: (pantryId: string) => {
    try {
      const cached = storage.getString(`${PANTRY_CACHE_PREFIX}${pantryId}`);
      if (!cached) return null;

      const parsed: CachedPantryData = JSON.parse(cached);
      return {
        itemCount: parsed.items?.length || 0,
        timestamp: parsed.timestamp,
        age: Date.now() - parsed.timestamp,
        isFresh: Date.now() - parsed.timestamp < CACHE_EXPIRY_MS,
        version: parsed.version,
      };
    } catch (error) {
      return null;
    }
  },
};