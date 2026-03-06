import { NormalizedCacheObject } from '@apollo/client';
import { storage } from '#storage/mmkv';

const CACHE_STORAGE_KEY = 'apollo-cache-v1';
const CACHE_VERSION_KEY = 'apollo-cache-version';
const CURRENT_CACHE_VERSION = '1.1.4'; // Purge stale convertQuantity cache entries

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
  private idleCallbackId: number | null = null;
  private readonly debounceMs = 3000; // Wait 3s before saving to reduce writes during burst operations
  private paused = false;
  private pendingWhilePaused = false;
  private pausedExtractor: (() => NormalizedCacheObject) | null = null;

  /**
   * Load persisted cache from MMKV storage
   * Returns null if no cache exists or if cache version is outdated
   */
  load(): NormalizedCacheObject | null {
    try {
      // Check cache version
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) {
        if (__DEV__) {
          console.log(
            `📦 Cache: Version mismatch (stored: ${storedVersion}, current: ${CURRENT_CACHE_VERSION}), clearing cache`,
          );
        }
        this.clear();
        return null;
      }

      // Load cache data
      const cacheString = storage.getString(CACHE_STORAGE_KEY);
      if (!cacheString) {
        if (__DEV__) {
          console.log('📦 Cache: No persisted cache found');
        }
        return null;
      }

      const cache = JSON.parse(cacheString) as NormalizedCacheObject;
      const entityCount = Object.keys(cache).length;

      if (__DEV__) {
        console.log(`📦 Cache: Loaded ${entityCount} entities from storage`);
      }
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
    this.scheduleExtractAndSave(() => cache);
  }

  /**
   * Pause cache persistence.
   * While paused, scheduleExtractAndSave calls are suppressed.
   * Call resume() to re-enable and flush any pending save.
   */
  pause(): void {
    this.paused = true;
    // Cancel any pending save so it doesn't fire during the pause
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
  }

  /**
   * Resume cache persistence after a pause.
   * If any saves were requested while paused, schedules a single deferred save.
   */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.pendingWhilePaused && this.pausedExtractor) {
      this.pendingWhilePaused = false;
      const extractor = this.pausedExtractor;
      this.pausedExtractor = null;
      this.scheduleExtractAndSave(extractor);
    } else {
      this.pendingWhilePaused = false;
      this.pausedExtractor = null;
    }
  }

  /**
   * Schedule a lazy cache extraction and save (debounced)
   *
   * Unlike save(), this defers cache.extract() until after the debounce period,
   * so only one extract() call happens per debounce window instead of one per
   * cache operation (write, evict, modify, gc).
   *
   * @param extractor - Lazy function that returns the cache data when called
   */
  scheduleExtractAndSave(extractor: () => NormalizedCacheObject): void {
    if (this.paused) {
      this.pendingWhilePaused = true;
      this.pausedExtractor = extractor;
      return;
    }
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Debounce saves to avoid excessive writes
    this.saveTimeout = setTimeout(() => {
      // PERFORMANCE: Use requestIdleCallback to run serialization when JS thread is idle
      // This prevents blocking UI interactions and list rendering
      // Falls back to requestAnimationFrame which defers until after current paint
      const serialize = () => {
        try {
          // Extract cache data lazily - only runs once after debounce
          const cache = extractor();
          const cacheString = JSON.stringify(cache);
          const sizeKB = Math.round(cacheString.length / 1024);

          storage.set(CACHE_STORAGE_KEY, cacheString);
          storage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);

          if (__DEV__) {
            console.log(`💾 Cache: Persisted cache (${sizeKB} KB)`);
          }
        } catch (error) {
          console.error('💾 Cache: Failed to persist cache:', error);
        }
      };

      // Use requestIdleCallback if available (web/newer RN), otherwise use requestAnimationFrame
      // requestIdleCallback runs when browser is idle (optimal for background work)
      // requestAnimationFrame defers until after current frame paint (better than setTimeout)
      if (
        typeof globalThis !== 'undefined' &&
        'requestIdleCallback' in globalThis
      ) {
        // justified: requestIdleCallback not in React Native's global type definitions
        this.idleCallbackId = (globalThis as any).requestIdleCallback(serialize, { timeout: 2000 });
      } else if (typeof requestAnimationFrame === 'function') {
        // requestAnimationFrame defers to next frame, then use setTimeout to avoid blocking paint
        this.idleCallbackId = requestAnimationFrame(() => {
          setTimeout(serialize, 0);
        });
      } else {
        // Final fallback
        setTimeout(serialize, 0);
      }
    }, this.debounceMs);
  }

  /**
   * Cancel any pending debounced save
   * Call during logout to prevent writing stale cache data
   */
  cancel(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.idleCallbackId != null) {
      if (typeof globalThis !== 'undefined' && 'cancelIdleCallback' in globalThis) {
        (globalThis as any).cancelIdleCallback(this.idleCallbackId); // justified: cancelIdleCallback not in RN types
      } else if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.idleCallbackId);
      }
      this.idleCallbackId = null;
    }
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

      if (__DEV__) {
        console.log(`💾 Cache: Persisted cache immediately (${sizeKB} KB)`);
      }
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
      if (__DEV__) {
        console.log('🧹 Cache: Cleared persisted cache');
      }
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
   * PERFORMANCE: Single-pass validation - already optimized (reads both in one go)
   */
  isValid(): boolean {
    try {
      // PERFORMANCE: Read both version and cache in single pass
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      const cacheString = storage.getString(CACHE_STORAGE_KEY);

      return (
        storedVersion === CURRENT_CACHE_VERSION &&
        cacheString !== undefined &&
        cacheString !== null
      );
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance for global access
 */
export const apolloCachePersistence = new ApolloCachePersistence();
