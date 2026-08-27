import type { NormalizedCacheObject } from '@apollo/client';
import { storage, isStorageReady } from '#storage/mmkv';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

const CACHE_STORAGE_KEY = 'apollo-cache-v1';
const CACHE_VERSION_KEY = 'apollo-cache-version';
/**
 * Identifies the SHAPE of a persisted blob, not the app that wrote it.
 *
 * App version is not the right key: keying on it purges the cache on every
 * store update and every OTA, so a user's first launch after an update —
 * offline, on a plane, in a basement — is an empty app, the queue surviving
 * while nothing they can read does. A persisted blob is a raw
 * `NormalizedCacheObject` of field keys produced by `src/apollo/cache.ts`'s
 * type policies, so what makes an old blob unsafe is a change to THOSE, not a
 * version bump. Most such changes are harmless anyway — a changed `keyArgs`
 * strands old field keys, which is a cache miss and a refetch. The one that
 * genuinely bites is a changed `merge`/`read` running over a value written in
 * the old shape.
 *
 * So: bump this by hand when a change to `cache.ts` makes previously persisted
 * data unsafe to restore. `__tests__/apollo/cacheSchemaVersion.test.ts` fails
 * on any edit to that file until the change has been looked at, because a
 * hand-maintained constant that nothing checks will drift.
 */
const CURRENT_CACHE_VERSION = 'shape-1';

/**
 * Written by a previous scheme that split the cache into a small "critical"
 * blob (ROOT_QUERY + User/Home/settings) restored at startup and a "deferred"
 * blob restored from `requestIdleCallback`.
 *
 * The deferral never ran: the client read both blobs eagerly and merged them,
 * so the split only added a second MMKV read and a second `JSON.parse` to every
 * cold start. It could not have run as designed either — `ROOT_QUERY` sat in
 * the critical blob while the entities its `__ref`s point at sat in the
 * deferred one, so a critical-only restore leaves every list query's cache read
 * incomplete and Apollo returns no data for it. Restoring the "fast" half
 * would have painted nothing and refetched everything, which is the opposite of
 * why the cache is persisted.
 *
 * The names remain so `load()` can migrate an install that still has data under
 * them, and so `clear()` removes them at session end rather than stranding the
 * previous person's entities on disk.
 */
const LEGACY_SPLIT_KEYS = [
  'apollo-cache-v1-critical',
  'apollo-cache-v1-deferred',
];

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

/**
 * Whether anything in the normalized cache differs from the last persisted
 * snapshot.
 *
 * Compares object identity per top-level key rather than value. `extract()`
 * hands back the store's own entity objects, so an untouched entity keeps its
 * reference across extracts and a modified one gets a new one — the scan is
 * `Object.keys(cache).length` pointer comparisons, cheaper by far than the
 * `JSON.stringify` of the whole cache it guards.
 *
 * It has to be the whole cache, not a set of keys reported by the writers.
 * `cache.write` for a query result reports only `ROOT_QUERY`, and ROOT_QUERY
 * holds `__ref` pointers: when a refetch returns new field values for entities
 * already cached, every ref is the same, ROOT_QUERY keeps its identity, and the
 * key count is unchanged. Under the old per-key check that read as "nothing
 * changed", so the edit was never written to disk and the next cold start
 * restored the previous values.
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
   * Read a cache left behind by the split-blob scheme, for an install that
   * upgraded before ever saving under the single key.
   *
   * Without this the first launch after the upgrade starts from an empty
   * cache — one extra fetch online, and a blank app for a person who is
   * offline at that moment. The next save writes the single key and removes
   * these, so this path runs at most once per install.
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
   * Flush a pending debounced save immediately — call when the app goes to
   * background, where a fast kill could otherwise lose the last ≤3s of cache
   * writes. The offline queue durably persists the mutations regardless, but
   * without this the optimistic cache state only reappears after the queue
   * replays on next launch; flushing keeps it visible from disk on cold start.
   *
   * No-op when nothing is pending (no debounced save and no scheduled idle
   * serialization), so it's cheap to call on every background transition.
   *
   * @param extractor - Lazy cache extractor; only invoked when a save is pending.
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
