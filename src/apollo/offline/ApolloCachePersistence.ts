import type { NormalizedCacheObject } from '@apollo/client';
import { storage, isStorageReady, isRecoveryStorage } from '#storage/mmkv';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

const CACHE_STORAGE_KEY = 'apollo-cache-v1';
const CACHE_VERSION_KEY = 'apollo-cache-version';
/**
 * The SHAPE of a persisted blob, not the app that wrote it — keying on app
 * version would purge the cache on every update. Bump by hand when a `cache.ts`
 * change makes persisted data unsafe; `cacheSchemaVersion.test.ts` fails on any
 * edit to that file until the decision has been made.
 */
const CURRENT_CACHE_VERSION = 'shape-1';

/**
 * Keys from a retired split-blob scheme. Kept so `load()` can migrate an install
 * that still has data under them, and so `clear()` removes them at session end
 * rather than stranding the previous person's entities on disk.
 */
const LEGACY_SPLIT_KEYS = [
  'apollo-cache-v1-critical',
  'apollo-cache-v1-deferred',
];

/**
 * Identity per top-level key, not value: `extract()` returns the store's own
 * objects, so an untouched entity keeps its reference. Must scan the WHOLE
 * cache — writers report only `ROOT_QUERY`, whose `__ref`s are unchanged when a
 * refetch updates entities in place, so a per-key check reads as "no change".
 */
function hasCacheChanged(
  cache: NormalizedCacheObject,
  snapshot: NormalizedCacheObject,
): boolean {
  const keys = Object.keys(cache);
  if (keys.length !== Object.keys(snapshot).length) return true;
  for (const key of keys) {
    if (cache[key] !== snapshot[key]) return true;
  }
  return false;
}

class ApolloCachePersistence {
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private idleCallbackId: number | null = null;
  private readonly debounceMs = 3000; // Wait 3s before saving to reduce writes during burst operations
  private paused = false;
  private pendingWhilePaused = false;
  private pausedExtractor: (() => NormalizedCacheObject) | null = null;

  // Dirty-key tracking: skip serialization when nothing actually changed
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
          logger.debug(
            `📦 Cache: Version mismatch (stored: ${storedVersion}, current: ${CURRENT_CACHE_VERSION}), clearing cache`,
          );
        }
        this.clear();
        return null;
      }

      // Load cache data
      const cacheString = storage.getString(CACHE_STORAGE_KEY);
      if (!cacheString) {
        const migrated = this.loadLegacySplitCache();
        if (migrated) return migrated;
        if (__DEV__) {
          logger.debug('📦 Cache: No persisted cache found');
        }
        return null;
      }

      const cache = JSON.parse(cacheString) as NormalizedCacheObject;
      const entityCount = Object.keys(cache).length;

      if (__DEV__) {
        logger.debug(`📦 Cache: Loaded ${entityCount} entities from storage`);
      }
      return cache;
    } catch (error) {
      logger.error('📦 Cache: Failed to load persisted cache:', error);
      // Clear corrupted cache
      this.clear();
      return null;
    }
  }

  /**
   * Read a cache left by the split-blob scheme, so an install that upgraded
   * before saving under the single key does not start empty. The next save
   * writes the single key and removes these, so this runs once per install.
   */
  private loadLegacySplitCache(): NormalizedCacheObject | null {
    const merged: NormalizedCacheObject = {};
    let found = false;
    for (const key of LEGACY_SPLIT_KEYS) {
      const stored = storage.getString(key);
      if (!stored) continue;
      Object.assign(merged, JSON.parse(stored) as NormalizedCacheObject);
      found = true;
    }
    if (!found) return null;
    logger.info(
      `📦 Cache: Migrated ${
        Object.keys(merged).length
      } entities from the split-blob format`,
    );
    return merged;
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
        logger.debug('💾 [CachePersist] Resuming with pending save');
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
   * Debounced save that defers `cache.extract()` until the window closes, so
   * one extract happens per window rather than one per cache operation.
   */
  scheduleExtractAndSave(extractor: () => NormalizedCacheObject): void {
    // The cache holds server data — names, emails, household membership. On the
    // unencrypted recovery instance the session may continue, but none of that
    // may reach disk. Returning BEFORE the debounce also leaves no timer to
    // fire after the decision was made.
    if (isRecoveryStorage()) return;
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

          // Skip serialization when nothing in the cache actually changed.
          if (
            this.lastPersistedSnapshot &&
            !hasCacheChanged(cache, this.lastPersistedSnapshot)
          ) {
            if (__DEV__) {
              logger.debug('💾 [CachePersist] skipped — cache unchanged');
            }
            return;
          }

          const cacheString = JSON.stringify(cache);
          const tStringify = performance.now();
          const sizeKB = Math.round(cacheString.length / 1024);

          storage.set(CACHE_STORAGE_KEY, cacheString);
          storage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION);
          this.removeLegacySplitCache();
          this.lastPersistedSnapshot = cache;

          // Persisted-cache size and serialize cost are release signals — they
          // bear on cold start — so they report from every build. Only the
          // human-readable breadcrumb stays dev-gated.
          Telemetry.histogram('cache_persist_extract_ms', tExtract - t0);
          Telemetry.histogram(
            'cache_persist_stringify_ms',
            tStringify - tExtract,
          );
          Telemetry.gauge('cache_persist_size_kb', sizeKB);

          if (__DEV__) {
            const extractMs = (tExtract - t0).toFixed(2);
            const stringifyMs = (tStringify - tExtract).toFixed(2);
            const totalMs = (tStringify - t0).toFixed(2);
            logger.debug(
              `💾 [CachePersist] extract=${extractMs}ms stringify=${stringifyMs}ms total=${totalMs}ms size=${sizeKB}KB entities=${
                Object.keys(cache).length
              }`,
            );
          }
        } catch (error) {
          logger.error('💾 Cache: Failed to persist cache:', error);
        }
      };

      // Defer serialization to when the JS thread is idle
      this.idleCallbackId = requestIdleCallback(serialize);
    }, this.debounceMs);
  }

  /**
   * Cancel any pending debounced save. Call during logout to prevent writing
   * stale cache data back into storage after it has been wiped.
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
  }

  /**
   * Flush a pending debounced save — call on background, where a fast kill
   * would otherwise lose the last ≤3s of writes and leave optimistic state
   * invisible until the queue replays. A no-op when nothing is pending.
   */
  flushPending(extractor: () => NormalizedCacheObject): void {
    if (this.saveTimeout == null && this.idleCallbackId == null) return;
    if (this.idleCallbackId != null) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    this.saveImmediate(extractor());
  }

  /**
   * Save cache immediately without debouncing
   * Use for critical operations like logout or app termination
   *
   * @param cache - Normalized cache object from cache.extract()
   */
  saveImmediate(cache: NormalizedCacheObject): void {
    if (isRecoveryStorage()) return;
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
      this.removeLegacySplitCache();
      this.lastPersistedSnapshot = cache;

      if (__DEV__) {
        logger.debug(`💾 Cache: Persisted cache immediately (${sizeKB} KB)`);
      }
    } catch (error) {
      logger.error('💾 Cache: Failed to persist cache immediately:', error);
    }
  }

  /**
   * Clear persisted cache from storage
   * Call on logout or cache invalidation
   */
  clear(): void {
    if (!isStorageReady()) return;
    try {
      // Cancel any pending save so nothing writes stale data back into
      // storage after we wipe it.
      this.cancel();

      storage.remove(CACHE_STORAGE_KEY);
      storage.remove(CACHE_VERSION_KEY);
      this.removeLegacySplitCache();
      this.lastPersistedSnapshot = null;
      if (__DEV__) {
        logger.debug('🧹 Cache: Cleared persisted cache');
      }
    } catch (error) {
      logger.error('🧹 Cache: Failed to clear persisted cache:', error);
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

      const cacheString = storage.getString(CACHE_STORAGE_KEY);
      if (cacheString) {
        const cache = JSON.parse(cacheString) as NormalizedCacheObject;
        return {
          exists: true,
          version: version || null,
          sizeKB: Math.round(cacheString.length / 1024),
          entityCount: Object.keys(cache).length,
        };
      }

      // An install that has not saved since upgrading off the split format.
      const legacy = this.legacySplitCacheStats();
      if (legacy.bytes > 0) {
        return {
          exists: true,
          version: version || null,
          sizeKB: Math.round(legacy.bytes / 1024),
          entityCount: legacy.entityCount,
        };
      }

      return {
        exists: false,
        version: null,
        sizeKB: null,
        entityCount: null,
      };
    } catch (error) {
      logger.error('📊 Cache: Failed to get stats:', error);
      return {
        exists: false,
        version: null,
        sizeKB: null,
        entityCount: null,
      };
    }
  }

  /** Whether a cache exists that this app version can restore. */
  isValid(): boolean {
    try {
      const storedVersion = storage.getString(CACHE_VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) return false;

      if (storage.getString(CACHE_STORAGE_KEY) != null) return true;
      return LEGACY_SPLIT_KEYS.some(key => storage.getString(key) != null);
    } catch {
      return false;
    }
  }

  /** Size and entity count still held under the split-format keys. */
  private legacySplitCacheStats(): { bytes: number; entityCount: number } {
    let bytes = 0;
    let entityCount = 0;
    for (const key of LEGACY_SPLIT_KEYS) {
      const stored = storage.getString(key);
      if (!stored) continue;
      bytes += stored.length;
      entityCount += Object.keys(
        JSON.parse(stored) as NormalizedCacheObject,
      ).length;
    }
    return { bytes, entityCount };
  }

  /**
   * Drop the split-format blobs. Called after every save (so the migration
   * runs at most once) and on clear (so a session end does not strand the
   * previous person's entities under a key nothing reads any more).
   */
  private removeLegacySplitCache(): void {
    for (const key of LEGACY_SPLIT_KEYS) storage.remove(key);
  }
}

/**
 * Singleton instance for global access
 */
export const apolloCachePersistence = new ApolloCachePersistence();
