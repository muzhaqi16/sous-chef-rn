import { NormalizedCacheObject } from '@apollo/client';
import { storage } from '#storage/mmkv';

const CACHE_STORAGE_KEY = 'apollo-cache-v1';
const CACHE_VERSION_KEY = 'apollo-cache-version';
const CURRENT_CACHE_VERSION = '1.1.2'; // Increment this to invalidate old caches (bumped to clear cache corrupted by __ref spread)

/**
 * Custom Apollo cache persistence using MMKV
 *
 * This is a lightweight alternative to apollo3-cache-persist that:
 * - Works with Apollo Client 4.x
 * - Uses your existing MMKV storage (faster than AsyncStorage)
 * - Provides production-ready cache persistence
 * - No external dependencies or compatibility issues
 *
 * Usage:
 * ```typescript
 * // On app start (before creating Apollo client)
 * const persistedCache = apolloCachePersistence.load();
 * const cache = makeCache();
 * if (persistedCache) {
 *   cache.restore(persistedCache);
 * }
 *
 * // After mutations (debounced)
 * apolloCachePersistence.save(client.cache.extract());
 *
 * // On logout
 * apolloCachePersistence.clear();
 * ```
 */
class ApolloCachePersistence {
  private saveTimeout: NodeJS.Timeout | null = null;
  private readonly debounceMs = 1000; // Wait 1s before saving to reduce writes

  /**
   * Load persisted cache from MMKV storage
   * Returns null if no cache exists or if cache version is outdated
   */
  load(): NormalizedCacheObject | null {
    try {
      // Check cache version
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) {
        console.log(
          `📦 Cache: Version mismatch (stored: ${storedVersion}, current: ${CURRENT_CACHE_VERSION}), clearing cache`,
        );
        this.clear();
        return null;
      }

      // Load cache data
      const cacheString = storage.getString(CACHE_STORAGE_KEY);
      if (!cacheString) {
        console.log('📦 Cache: No persisted cache found');
        return null;
      }

      const cache = JSON.parse(cacheString) as NormalizedCacheObject;
      const entityCount = Object.keys(cache).length;

      console.log(`📦 Cache: Loaded ${entityCount} entities from storage`);
      return cache;
    } catch (error) {
      console.error('📦 Cache: Failed to load persisted cache:', error);
      // Clear corrupted cache
      this.clear();
      return null;
    }
  }

  /**
   * Save cache to MMKV storage (debounced)
   *
   * @param cache - Normalized cache object from cache.extract()
   */
  save(cache: NormalizedCacheObject): void {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce saves to avoid excessive writes
    this.saveTimeout = setTimeout(() => {
      try {
        const cacheString = JSON.stringify(cache);
        const sizeKB = Math.round(cacheString.length / 1024);

        storage.set(CACHE_STORAGE_KEY, cacheString);
        storage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);

        console.log(`💾 Cache: Persisted cache (${sizeKB} KB)`);
      } catch (error) {
        console.error('💾 Cache: Failed to persist cache:', error);
      }
    }, this.debounceMs);
  }

  /**
   * Save cache immediately without debouncing
   * Use for critical operations like logout or app termination
   *
   * @param cache - Normalized cache object from cache.extract()
   */
  saveImmediate(cache: NormalizedCacheObject): void {
    // Clear pending debounced save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      const cacheString = JSON.stringify(cache);
      const sizeKB = Math.round(cacheString.length / 1024);

      storage.set(CACHE_STORAGE_KEY, cacheString);
      storage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);

      console.log(`💾 Cache: Persisted cache immediately (${sizeKB} KB)`);
    } catch (error) {
      console.error('💾 Cache: Failed to persist cache immediately:', error);
    }
  }

  /**
   * Clear persisted cache from storage
   * Call on logout or cache invalidation
   */
  clear(): void {
    try {
      // Clear pending save
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
        this.saveTimeout = null;
      }

      storage.remove(CACHE_STORAGE_KEY);
      storage.remove(CACHE_VERSION_KEY);
      console.log('🧹 Cache: Cleared persisted cache');
    } catch (error) {
      console.error('🧹 Cache: Failed to clear persisted cache:', error);
    }
  }

  /**
   * Get cache statistics
   * Useful for debugging and monitoring
   */
  getStats(): {
    exists: boolean;
    version: string | null;
    sizeKB: number | null;
    entityCount: number | null;
  } {
    try {
      const cacheString = storage.getString(CACHE_STORAGE_KEY);
      const version = storage.getString(CACHE_VERSION_KEY);

      if (!cacheString) {
        return {
          exists: false,
          version: null,
          sizeKB: null,
          entityCount: null,
        };
      }

      const cache = JSON.parse(cacheString) as NormalizedCacheObject;
      return {
        exists: true,
        version: version || null,
        sizeKB: Math.round(cacheString.length / 1024),
        entityCount: Object.keys(cache).length,
      };
    } catch (error) {
      console.error('📊 Cache: Failed to get stats:', error);
      return {
        exists: false,
        version: null,
        sizeKB: null,
        entityCount: null,
      };
    }
  }

  /**
   * Check if cache is valid and can be restored
   */
  isValid(): boolean {
    try {
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      const cacheString = storage.getString(CACHE_STORAGE_KEY);

      return (
        storedVersion === CURRENT_CACHE_VERSION &&
        cacheString !== undefined &&
        cacheString !== null
      );
    } catch (error) {
      return false;
    }
  }
}

/**
 * Singleton instance for global access
 */
export const apolloCachePersistence = new ApolloCachePersistence();
