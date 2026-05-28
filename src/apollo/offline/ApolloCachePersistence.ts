import type {
  ApolloCache,
  InMemoryCache,
  NormalizedCacheObject,
} from '@apollo/client';
import { getVersion } from 'react-native-device-info';
import { storage, isStorageReady } from '#storage/mmkv';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

const CACHE_STORAGE_KEY = 'apollo-cache-v1';
const CRITICAL_CACHE_KEY = 'apollo-cache-v1-critical';
const DEFERRED_CACHE_KEY = 'apollo-cache-v1-deferred';
const CACHE_VERSION_KEY = 'apollo-cache-version';
const CURRENT_CACHE_VERSION = getVersion(); // Purge stale cache on every app version bump

/**
 * Typenames restored synchronously at startup (~30 entities, ~5KB).
 * Everything else is deferred to requestIdleCallback.
 */
const CRITICAL_TYPENAMES = new Set([
  'User',
  'Home',
  'NotificationPreferences',
  'UserProfile',
  'UserSettings',
  'DietaryProfile',
]);

/** Special Apollo root keys that must always be in the critical partition */
const CRITICAL_ROOT_KEYS = new Set([
  'ROOT_QUERY',
  'ROOT_MUTATION',
  'ROOT_SUBSCRIPTION',
  '__META',
]);

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
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private idleCallbackId: number | null = null;
  private restoreIdleCallbackId: number | null = null;
  private readonly debounceMs = 3000; // Wait 3s before saving to reduce writes during burst operations
  private paused = false;
  private pendingWhilePaused = false;
  private pausedExtractor: (() => NormalizedCacheObject) | null = null;

  // Dirty-key tracking: skip serialization when nothing actually changed
  private dirtyKeys = new Set<string>();
  private lastPersistedSnapshot: NormalizedCacheObject | null = null;

  /**
   * Load persisted cache from MMKV storage
   * Returns null if no cache exists or if cache version is outdated
   */
  load(): NormalizedCacheObject | null {
    if (!isStorageReady()) return null;
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
   * Load only critical entities (ROOT_QUERY, User, Home, settings) from storage.
   * Returns null if no split-key cache exists (triggers migration fallback).
   */
  loadCritical(): NormalizedCacheObject | null {
    if (!isStorageReady()) return null;
    try {
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) {
        return null; // Caller falls back to load() for migration
      }

      const cacheString = storage.getString(CRITICAL_CACHE_KEY);
      if (!cacheString) return null;

      const cache = JSON.parse(cacheString) as NormalizedCacheObject;

      if (__DEV__) {
        console.log(
          `📦 Cache: Loaded ${
            Object.keys(cache).length
          } critical entities from storage`,
        );
      }
      return cache;
    } catch (error) {
      console.error('📦 Cache: Failed to load critical cache:', error);
      return null;
    }
  }

  /**
   * Restore bulk persisted entities (PantryItem, ShoppingListItem, Recipe, …)
   * when the JS thread is idle. Call from the app entry (`App.tsx` useEffect)
   * after first paint. If the idle callback hasn't fired when a screen mounts,
   * the cache miss falls back to network — the first page renders fast.
   *
   * Tracked via `restoreIdleCallbackId` so `cancel()` (called on logout) can
   * abort a pending restore and avoid writing stale entities into a cleared
   * cache.
   */
  restoreDeferred(cache: ApolloCache, onComplete?: () => void): void {
    // Cancel any prior in-flight restore so two calls don't race.
    if (this.restoreIdleCallbackId != null) {
      cancelIdleCallback(this.restoreIdleCallbackId);
      this.restoreIdleCallbackId = null;
    }

    this.restoreIdleCallbackId = requestIdleCallback(() => {
      // `cancel()` / `clear()` set the id to null. Bail out before touching
      // the cache so a logout fired between scheduling and firing doesn't
      // resurrect stale entities into a cleared cache.
      // Intentionally do NOT call onComplete here — the cancel was deliberate.
      if (this.restoreIdleCallbackId == null) return;
      this.restoreIdleCallbackId = null;
      const t0 = performance.now();
      try {
        const deferred = this.loadDeferred();
        if (!deferred) return;
        // cache.restore() is destructive (wipes the EntityStore via init()).
        // Merge deferred entities with existing cache to avoid losing data.
        const existing = (cache as InMemoryCache).extract();
        (cache as InMemoryCache).restore({ ...existing, ...deferred });
        Telemetry.histogram(
          'app_apollo_deferred_restore_ms',
          performance.now() - t0,
        );
        logger.info('📦 Apollo: Deferred cache restore complete');
      } catch (error) {
        // A corrupt deferred blob shouldn't crash the JS thread — drop it and
        // let the next save overwrite. Network refetch covers the data.
        console.error('📦 Apollo: Deferred cache restore failed:', error);
        storage.remove(DEFERRED_CACHE_KEY);
      } finally {
        onComplete?.();
      }
    });
  }

  /**
   * Load deferred (bulk) entities from storage.
   * Called from requestIdleCallback after critical restore.
   */
  loadDeferred(): NormalizedCacheObject | null {
    if (!isStorageReady()) return null;
    try {
      // Mirror loadCritical()'s version guard: if a stale deferred blob
      // survived a partial clear (e.g. crash mid-clear), don't resurrect
      // entities from an incompatible schema.
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) return null;

      const cacheString = storage.getString(DEFERRED_CACHE_KEY);
      if (!cacheString) return null;

      const t0 = performance.now();
      const cache = JSON.parse(cacheString) as NormalizedCacheObject;
      const elapsed = performance.now() - t0;

      if (__DEV__) {
        console.log(
          `📦 Cache: Deferred restore ${
            Object.keys(cache).length
          } entities in ${elapsed.toFixed(1)}ms`,
        );
      }
      return cache;
    } catch (error) {
      console.error('📦 Cache: Failed to load deferred cache:', error);
      return null;
    }
  }

  /**
   * Partition a normalized cache into critical and deferred buckets.
   * Single-pass classification by cache key / __typename.
   */
  partitionCache(cache: NormalizedCacheObject): {
    critical: NormalizedCacheObject;
    deferred: NormalizedCacheObject;
  } {
    const critical: NormalizedCacheObject = {};
    const deferred: NormalizedCacheObject = {};

    for (const key in cache) {
      if (this.isCriticalKey(key)) {
        critical[key] = cache[key];
      } else {
        deferred[key] = cache[key];
      }
    }
    return { critical, deferred };
  }

  /**
   * Determine if a cache key belongs to the critical partition.
   * Checks root keys first, then extracts typename from the "Type:id" format.
   */
  private isCriticalKey(key: string): boolean {
    if (CRITICAL_ROOT_KEYS.has(key)) return true;
    // Apollo cache keys follow the pattern "TypeName:id"
    const colonIndex = key.indexOf(':');
    if (colonIndex === -1) return false;
    const typename = key.substring(0, colonIndex);
    return CRITICAL_TYPENAMES.has(typename);
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
      if (__DEV__) {
        console.log('💾 [CachePersist] Resuming with pending save');
      }
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
   * Mark cache keys as potentially dirty.
   * Used by cache wrapper hooks to flag which entities may have changed,
   * enabling the persist path to skip serialization when nothing changed.
   */
  markDirty(keys: string[]): void {
    for (const key of keys) {
      this.dirtyKeys.add(key);
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
      const serialize = () => {
        try {
          const t0 = performance.now();
          // Extract cache data lazily - only runs once after debounce
          const cache = extractor();
          const tExtract = performance.now();

          // Skip serialization if dirty keys haven't actually changed
          if (this.lastPersistedSnapshot && this.dirtyKeys.size > 0) {
            let hasChanges = false;
            for (const key of this.dirtyKeys) {
              if (cache[key] !== this.lastPersistedSnapshot[key]) {
                hasChanges = true;
                break;
              }
            }
            // Also check if keys were added or removed
            if (!hasChanges) {
              const cacheKeys = Object.keys(cache).length;
              const snapshotKeys = Object.keys(
                this.lastPersistedSnapshot,
              ).length;
              hasChanges = cacheKeys !== snapshotKeys;
            }
            if (!hasChanges) {
              this.dirtyKeys.clear();
              if (__DEV__) {
                console.log(
                  '💾 [CachePersist] skipped — no changes in dirty keys',
                );
              }
              return;
            }
          }

          const { critical, deferred } = this.partitionCache(cache);
          const criticalString = JSON.stringify(critical);
          const deferredString = JSON.stringify(deferred);
          const tStringify = performance.now();
          const sizeKB = Math.round(
            (criticalString.length + deferredString.length) / 1024,
          );

          storage.set(CRITICAL_CACHE_KEY, criticalString);
          storage.set(DEFERRED_CACHE_KEY, deferredString);
          storage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
          // Migration cleanup: remove old single-key format
          storage.remove(CACHE_STORAGE_KEY);
          this.lastPersistedSnapshot = cache;
          this.dirtyKeys.clear();

          if (__DEV__) {
            const extractMs = (tExtract - t0).toFixed(2);
            const stringifyMs = (tStringify - tExtract).toFixed(2);
            const totalMs = (tStringify - t0).toFixed(2);
            console.log(
              `💾 [CachePersist] extract=${extractMs}ms stringify=${stringifyMs}ms total=${totalMs}ms size=${sizeKB}KB critical=${
                Object.keys(critical).length
              } deferred=${Object.keys(deferred).length}`,
            );
            Telemetry.histogram('cache_persist_extract_ms', tExtract - t0);
            Telemetry.histogram(
              'cache_persist_stringify_ms',
              tStringify - tExtract,
            );
            Telemetry.gauge('cache_persist_size_kb', sizeKB);
          }
        } catch (error) {
          console.error('💾 Cache: Failed to persist cache:', error);
        }
      };

      // Defer serialization to when the JS thread is idle
      this.idleCallbackId = requestIdleCallback(serialize);
    }, this.debounceMs);
  }

  /**
   * Cancel any pending debounced save or in-flight deferred restore.
   * Call during logout to prevent writing stale cache data, or to abort a
   * deferred restore before it writes stale entities into a cleared cache.
   */
  cancel(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.idleCallbackId != null) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    if (this.restoreIdleCallbackId != null) {
      cancelIdleCallback(this.restoreIdleCallbackId);
      this.restoreIdleCallbackId = null;
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
      const { critical, deferred } = this.partitionCache(cache);
      const criticalString = JSON.stringify(critical);
      const deferredString = JSON.stringify(deferred);
      const sizeKB = Math.round(
        (criticalString.length + deferredString.length) / 1024,
      );

      storage.set(CRITICAL_CACHE_KEY, criticalString);
      storage.set(DEFERRED_CACHE_KEY, deferredString);
      storage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
      // Migration cleanup: remove old single-key format
      storage.remove(CACHE_STORAGE_KEY);
      this.lastPersistedSnapshot = cache;
      this.dirtyKeys.clear();

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
    if (!isStorageReady()) return;
    try {
      // Cancel all pending saves and deferred restores so nothing writes
      // stale data back into storage or the cache after we wipe it.
      this.cancel();

      storage.remove(CACHE_STORAGE_KEY);
      storage.remove(CRITICAL_CACHE_KEY);
      storage.remove(DEFERRED_CACHE_KEY);
      storage.remove(CACHE_VERSION_KEY);
      this.lastPersistedSnapshot = null;
      this.dirtyKeys.clear();
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
      const version = storage.getString(CACHE_VERSION_KEY);

      // Try new split-key format first
      const criticalString = storage.getString(CRITICAL_CACHE_KEY);
      const deferredString = storage.getString(DEFERRED_CACHE_KEY);

      if (criticalString || deferredString) {
        const critical = criticalString
          ? (JSON.parse(criticalString) as NormalizedCacheObject)
          : {};
        const deferred = deferredString
          ? (JSON.parse(deferredString) as NormalizedCacheObject)
          : {};
        const totalSize =
          (criticalString?.length ?? 0) + (deferredString?.length ?? 0);
        return {
          exists: true,
          version: version || null,
          sizeKB: Math.round(totalSize / 1024),
          entityCount:
            Object.keys(critical).length + Object.keys(deferred).length,
        };
      }

      // Fallback to old single-key format
      const cacheString = storage.getString(CACHE_STORAGE_KEY);
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
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) return false;

      // Check new split-key format first, then old single-key
      const hasCritical = storage.getString(CRITICAL_CACHE_KEY) != null;
      if (hasCritical) return true;

      const hasLegacy = storage.getString(CACHE_STORAGE_KEY) != null;
      return hasLegacy;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance for global access
 */
export const apolloCachePersistence = new ApolloCachePersistence();
