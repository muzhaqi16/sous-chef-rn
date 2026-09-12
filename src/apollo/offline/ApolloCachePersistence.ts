import type { NormalizedCacheObject } from '@apollo/client';
import { storage, isStorageReady, isRecoveryStorage } from '#storage/mmkv';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

const CACHE_STORAGE_KEY = 'apollo-cache-v1';
const CACHE_VERSION_KEY = 'apollo-cache-version';
/**
 * The SHAPE of a persisted blob, not the app that wrote it. Bump by hand for a
 * `cache.ts` change that makes old data unsafe, OR a server change that
 * redefines what persisted data means — retired ids and rewritten values parse
 * cleanly and are still wrong. `cacheSchemaVersion.test.ts` pins it.
 */
const CURRENT_CACHE_VERSION = 'shape-2';
/** Keys nothing writes; `clear()` removes them so a session end strands nothing. */
const LEGACY_SPLIT_KEYS = [
  'apollo-cache-v1-critical',
  'apollo-cache-v1-deferred',
];
/** Freshly allocated by every `extract()`, so its reference is never stable. */
const META_KEY = '__META';
const DEBOUNCE_MS = 3000;
/**
 * The window while no tab screen is focused: wider, because a detail screen's
 * writes are fewer and `cache.extract()` is the cost; still finite, so a kill
 * on that screen loses at most this window.
 */
const PAUSED_DEBOUNCE_MS = 10000;

type Extractor = () => NormalizedCacheObject;

/**
 * Identity per top-level key, not value: `extract()` returns the store's own
 * objects, so an untouched entity keeps its reference. Scans the WHOLE cache —
 * writers report only `ROOT_QUERY`, whose `__ref`s are unchanged when a refetch
 * updates entities in place, so a per-key check reads as "no change".
 */
function hasCacheChanged(
  cache: NormalizedCacheObject,
  snapshot: NormalizedCacheObject,
): boolean {
  const keys = Object.keys(cache).filter(k => k !== META_KEY);
  const snapshotKeys = Object.keys(snapshot).filter(k => k !== META_KEY);
  if (keys.length !== snapshotKeys.length) return true;
  for (const key of keys) {
    if (cache[key] !== snapshot[key]) return true;
  }
  // `__META` is excluded above because `extract()` allocates it fresh every
  // time, so its reference always differs. Its CONTENT still has to be compared
  // or a pin added with no entity change never reaches disk; the id list is
  // sorted by `extract()`, which makes length a sound cheap proxy.
  return metaPinCount(cache) !== metaPinCount(snapshot);
}

function metaPinCount(cache: NormalizedCacheObject): number {
  return cache[META_KEY]?.extraRootIds.length ?? 0;
}

/**
 * `restore()` re-`retain`s every id in `__META.extraRootIds`, so a pin whose
 * entity is already gone is re-established on each launch and the list only
 * ever grows. Dropping ids absent from the extract is safe: an absent id has no
 * entity to protect.
 */
function pruneExtraRootIds(cache: NormalizedCacheObject): void {
  const meta = cache[META_KEY];
  if (!meta) return;
  const live = meta.extraRootIds.filter(id => id in cache);
  if (live.length === meta.extraRootIds.length) return;
  if (live.length === 0) {
    delete cache[META_KEY];
    return;
  }
  cache[META_KEY] = { extraRootIds: live };
}

class ApolloCachePersistence {
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;
  private idleCallbackId: number | null = null;
  private paused = false;
  /** Non-null exactly while a write is owed; `persist` and `cancel` clear it. */
  private pendingExtractor: Extractor | null = null;
  private lastPersistedSnapshot: NormalizedCacheObject | null = null;

  /** Null when nothing is stored or the stored blob is not this shape. */
  load(): NormalizedCacheObject | null {
    if (!isStorageReady()) return null;
    try {
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

      const cacheString = storage.getString(CACHE_STORAGE_KEY);
      if (!cacheString) {
        if (__DEV__) {
          logger.debug('📦 Cache: No persisted cache found');
        }
        return null;
      }

      const cache = JSON.parse(cacheString) as NormalizedCacheObject;
      if (__DEV__) {
        logger.debug(
          `📦 Cache: Loaded ${Object.keys(cache).length} entities from storage`,
        );
      }
      return cache;
    } catch (error) {
      logger.error('📦 Cache: Failed to load persisted cache:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Debounced; `extractor` runs once when the window closes, not per cache op.
   * The cache holds server data that may not reach the unencrypted recovery
   * instance, so that check comes BEFORE the timer: nothing is left to fire.
   */
  scheduleExtractAndSave(extractor: Extractor): void {
    if (isRecoveryStorage()) return;
    this.pendingExtractor = extractor;
    this.clearHandles();
    this.saveTimeout = setTimeout(
      () => {
        this.saveTimeout = null;
        this.idleCallbackId = requestIdleCallback(() => {
          this.idleCallbackId = null;
          this.persist();
        });
      },
      this.paused ? PAUSED_DEBOUNCE_MS : DEBOUNCE_MS,
    );
  }

  /** Widens the debounce while no tab screen is focused; never stops it. */
  pause(): void {
    this.paused = true;
  }

  /** A save still waiting on the wide window is re-armed at the tight one. */
  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.saveTimeout !== null && this.pendingExtractor) {
      this.scheduleExtractAndSave(this.pendingExtractor);
    }
  }

  /**
   * Writes an owed save now — on app background, where a fast kill would
   * otherwise lose the last window of writes. A no-op when nothing is owed.
   */
  flushPending(): void {
    if (!this.pendingExtractor) return;
    this.clearHandles();
    this.persist();
  }

  cancel(): void {
    this.clearHandles();
    this.pendingExtractor = null;
  }

  /** Leaves nothing a later `load()` could restore. */
  clear(): void {
    if (!isStorageReady()) return;
    try {
      this.cancel();
      for (const key of [
        CACHE_STORAGE_KEY,
        CACHE_VERSION_KEY,
        ...LEGACY_SPLIT_KEYS,
      ]) {
        storage.remove(key);
      }
      this.lastPersistedSnapshot = null;
      if (__DEV__) {
        logger.debug('🧹 Cache: Cleared persisted cache');
      }
    } catch (error) {
      logger.error('🧹 Cache: Failed to clear persisted cache:', error);
    }
  }

  private clearHandles(): void {
    if (this.saveTimeout !== null) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.idleCallbackId !== null) {
      cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
  }

  private persist(): void {
    const extractor = this.pendingExtractor;
    this.pendingExtractor = null;
    // Storage can fall back to the recovery instance after the schedule.
    if (!extractor || isRecoveryStorage()) return;
    try {
      const t0 = performance.now();
      const cache = extractor();
      // Before the skip check, so the snapshot and every later extract are
      // compared in the same pruned shape.
      pruneExtraRootIds(cache);
      const tExtract = performance.now();

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
      this.lastPersistedSnapshot = cache;

      // Release signals — they bear on cold start — so never behind `__DEV__`.
      Telemetry.histogram('cache_persist_extract_ms', tExtract - t0);
      Telemetry.histogram('cache_persist_stringify_ms', tStringify - tExtract);
      Telemetry.gauge('cache_persist_size_kb', sizeKB);

      if (__DEV__) {
        logger.debug(
          `💾 [CachePersist] extract=${(tExtract - t0).toFixed(
            2,
          )}ms stringify=${(tStringify - tExtract).toFixed(
            2,
          )}ms size=${sizeKB}KB entities=${Object.keys(cache).length}`,
        );
      }
    } catch (error) {
      logger.error('💾 Cache: Failed to persist cache:', error);
    }
  }
}

export const apolloCachePersistence = new ApolloCachePersistence();
