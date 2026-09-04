'use no memo';

import type { StoreObject } from '@apollo/client';
import { storage } from '#storage/mmkv';
import { apolloCachePersistence } from '../ApolloCachePersistence';
import { logger } from '#/utils/environment';

const CACHE_KEY = 'apollo-cache-v1';
const CRITICAL_KEY = 'apollo-cache-v1-critical';
const DEFERRED_KEY = 'apollo-cache-v1-deferred';
const VERSION_KEY = 'apollo-cache-version';
// Identifies the shape of a persisted blob, not the app version that wrote it
// — `CURRENT_CACHE_VERSION` in ApolloCachePersistence. Keep in step with it.
const CURRENT_VERSION = 'shape-2';

describe('ApolloCachePersistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Clear underlying MMKV store (the mock uses a real Map)
    storage.clearAll();
    // Cancel any pending timers from previous tests
    apolloCachePersistence.cancel();
  });

  afterEach(() => {
    apolloCachePersistence.cancel();
    jest.useRealTimers();
  });

  describe('load', () => {
    it('returns null when no cache version is stored', () => {
      const result = apolloCachePersistence.load();
      expect(result).toBeNull();
    });

    it('returns null and clears when version mismatch', () => {
      storage.set(VERSION_KEY, '0.0.0');
      storage.set(CACHE_KEY, '{"old":"data"}');

      const result = apolloCachePersistence.load();
      expect(result).toBeNull();
      // Should have cleared the stale cache
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      expect(storage.getString(VERSION_KEY)).toBeUndefined();
    });

    it('returns null when no cache data exists but version matches', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);

      const result = apolloCachePersistence.load();
      expect(result).toBeNull();
    });

    it('returns parsed cache when version matches and data exists', () => {
      const cacheData = {
        ROOT_QUERY: { __typename: 'Query' },
        'User:1': { id: '1' },
      };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, JSON.stringify(cacheData));

      const result = apolloCachePersistence.load();
      expect(result).toEqual(cacheData);
    });

    it('survives an app version bump', () => {
      // What makes an old blob unsafe is a change to the type policies in
      // `cache.ts`, not a version bump — so the key describes the blob's shape
      // and the app version is not consulted at all.
      const cacheData = {
        'PantryItem:1': { id: '1', __typename: 'PantryItem' },
      };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, JSON.stringify(cacheData));

      jest
        .requireMock('react-native-device-info')
        .getVersion.mockReturnValue('9.9.9');

      expect(apolloCachePersistence.load()).toEqual(cacheData);
    });

    it('returns null and clears on JSON parse error', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, 'invalid-json{{{');

      const result = apolloCachePersistence.load();
      expect(result).toBeNull();
      // Should have cleared the corrupted cache
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });
  });

  describe('save (debounced)', () => {
    it('does not save immediately', () => {
      apolloCachePersistence.save({ ROOT_QUERY: {} });

      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('saves the whole cache under one key after the debounce elapses', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'PantryItem:1': { id: '1', __typename: 'PantryItem' },
      };
      apolloCachePersistence.save(cache);

      // Advance past debounce (3000ms)
      jest.advanceTimersByTime(3000);
      // The serialize runs via requestIdleCallback/requestAnimationFrame fallback
      jest.runAllTimers();

      expect(JSON.parse(storage.getString(CACHE_KEY)!)).toEqual(cache);
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
      // The retired split blobs are dropped, not left behind holding a copy.
      expect(storage.getString(CRITICAL_KEY)).toBeUndefined();
      expect(storage.getString(DEFERRED_KEY)).toBeUndefined();
    });

    it('debounces multiple rapid saves', () => {
      apolloCachePersistence.save({ 'A:1': { id: '1' } });
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.save({ 'B:2': { id: '2' } });
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.save({ 'C:3': { id: '3' } });

      // Advance fully
      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      // Only the last cache should be saved
      expect(JSON.parse(storage.getString(CACHE_KEY)!)).toEqual({
        'C:3': { id: '3' },
      });
    });
  });

  describe('change detection', () => {
    const settle = () => {
      jest.advanceTimersByTime(3000);
      jest.runAllTimers();
    };

    it('persists a change that only altered an entity’s values', () => {
      // The defect: `cache.write` for a query result reports only ROOT_QUERY as
      // dirty, and ROOT_QUERY holds `__ref` pointers — so when a refetch brings
      // new field values for entities already cached, its identity and the key
      // count are both unchanged. That read as "nothing changed", the save was
      // skipped, and the next cold start restored the previous values.
      const rootQuery = { 'pantryItem({})': { __ref: 'PantryItem:1' } };

      apolloCachePersistence.save({
        ROOT_QUERY: rootQuery,
        'PantryItem:1': { __typename: 'PantryItem', id: '1', name: 'Old' },
      });
      settle();
      expect(storage.getString(CACHE_KEY)).toContain('Old');

      // Same ROOT_QUERY object, same key count, new entity object — exactly
      // what Apollo produces for a refetch over a cached entity.
      apolloCachePersistence.save({
        ROOT_QUERY: rootQuery,
        'PantryItem:1': { __typename: 'PantryItem', id: '1', name: 'New' },
      });
      settle();

      const persisted = storage.getString(CACHE_KEY)!;
      expect(persisted).toContain('New');
      expect(persisted).not.toContain('Old');
    });

    it('still skips a save when nothing changed at all', () => {
      // The optimization has to survive the fix: identical extracts must not
      // re-serialize the whole cache on every debounce tick.
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'PantryItem:1': { __typename: 'PantryItem', id: '1', name: 'Same' },
      };
      apolloCachePersistence.save(cache);
      settle();

      const debugSpy = jest.spyOn(logger, 'debug');
      apolloCachePersistence.save(cache);
      settle();

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
      debugSpy.mockRestore();
    });

    it('persists an entity added without any other change', () => {
      const rootQuery = { __typename: 'Query' };
      apolloCachePersistence.save({ ROOT_QUERY: rootQuery });
      settle();

      apolloCachePersistence.save({
        ROOT_QUERY: rootQuery,
        'PantryItem:2': { __typename: 'PantryItem', id: '2' },
      });
      settle();

      expect(storage.getString(CACHE_KEY)).toContain('PantryItem:2');
    });

    it('persists an entity removed without any other change', () => {
      const rootQuery = { __typename: 'Query' };
      apolloCachePersistence.save({
        ROOT_QUERY: rootQuery,
        'PantryItem:3': { __typename: 'PantryItem', id: '3' },
      });
      settle();
      expect(storage.getString(CACHE_KEY)).toContain('PantryItem:3');

      apolloCachePersistence.save({ ROOT_QUERY: rootQuery });
      settle();

      expect(storage.getString(CACHE_KEY)).not.toContain('PantryItem:3');
    });
  });

  describe('flushPending', () => {
    it('writes a pending debounced save immediately', () => {
      apolloCachePersistence.save({
        ROOT_QUERY: { __typename: 'Query' },
        'Recipe:1': { id: '1' },
      });
      // Still debounced — nothing on disk yet.
      expect(storage.getString(CACHE_KEY)).toBeUndefined();

      apolloCachePersistence.flushPending(() => ({
        ROOT_QUERY: { __typename: 'Query' },
        'Recipe:1': { id: '1' },
      }));

      // Flushed synchronously, before the debounce timer fires.
      expect(JSON.parse(storage.getString(CACHE_KEY)!)).toEqual({
        ROOT_QUERY: { __typename: 'Query' },
        'Recipe:1': { id: '1' },
      });
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
    });

    it('is a no-op (and skips extraction) when nothing is pending', () => {
      apolloCachePersistence.cancel(); // ensure no pending timer
      const extractor = jest.fn(() => ({}));
      apolloCachePersistence.flushPending(extractor);
      expect(extractor).not.toHaveBeenCalled();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });
  });

  describe('saveImmediate', () => {
    it('persists the whole cache immediately without debounce', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'Recipe:1': { id: '1' },
      };
      apolloCachePersistence.saveImmediate(cache);

      expect(JSON.parse(storage.getString(CACHE_KEY)!)).toEqual(cache);
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
      expect(storage.getString(CRITICAL_KEY)).toBeUndefined();
      expect(storage.getString(DEFERRED_KEY)).toBeUndefined();
    });

    it('cancels any pending debounced save', () => {
      apolloCachePersistence.save({ 'Old:1': { id: '1' } });
      apolloCachePersistence.saveImmediate({ 'Immediate:1': { id: '1' } });

      // Advance timers to ensure debounced save does not fire
      jest.runAllTimers();

      const persisted = JSON.parse(storage.getString(CACHE_KEY)!);
      expect(persisted).toEqual({ 'Immediate:1': { id: '1' } });
    });

    it('handles serialization errors gracefully', () => {
      const circular: StoreObject = {};
      circular.self = circular;

      // Should not throw
      apolloCachePersistence.saveImmediate({ 'Circular:1': circular });
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('pause / resume', () => {
    it('suppresses saves while paused', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.save({ 'Paused:1': { id: '1' } });

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('flushes pending save on resume', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.save({ 'PausedData:1': { id: '1' } });
      apolloCachePersistence.resume();

      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      const persisted = JSON.parse(storage.getString(CACHE_KEY)!);
      expect(persisted).toEqual({ 'PausedData:1': { id: '1' } });
    });

    it('does nothing on resume if nothing was queued while paused', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.resume();

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('resume is a no-op when not paused', () => {
      // Should not throw
      apolloCachePersistence.resume();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('cancels pending debounced save when pausing', () => {
      apolloCachePersistence.save({ 'BeforePause:1': { id: '1' } });
      // Pause before debounce fires
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.pause();

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('uses the latest extractor when multiple saves happen while paused', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.save({ 'First:1': { id: '1' } });
      apolloCachePersistence.save({ 'Second:2': { id: '2' } });
      apolloCachePersistence.resume();

      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      // The last extractor should win
      const persisted = JSON.parse(storage.getString(CACHE_KEY)!);
      expect(persisted).toEqual({ 'Second:2': { id: '2' } });
    });
  });

  describe('cancel', () => {
    it('cancels pending debounced save', () => {
      apolloCachePersistence.save({ 'ShouldCancel:1': { id: '1' } });
      apolloCachePersistence.cancel();

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes all cache keys from storage', () => {
      storage.set(CACHE_KEY, '{"data":"old"}');
      storage.set(CRITICAL_KEY, '{"ROOT_QUERY":{}}');
      storage.set(DEFERRED_KEY, '{"PantryItem:1":{}}');
      storage.set(VERSION_KEY, CURRENT_VERSION);

      apolloCachePersistence.clear();

      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      expect(storage.getString(VERSION_KEY)).toBeUndefined();
    });

    it('cancels pending saves', () => {
      apolloCachePersistence.save({ 'BeforeClear:1': { id: '1' } });
      apolloCachePersistence.clear();

      jest.runAllTimers();
      // Cache should remain cleared, not re-populated by the debounced save
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    // The session-end path (store `endSession`) relies on this: once a server
    // verdict ends a session, the previous account's normalized entities must
    // not be restorable, or the next sign-in on the device paints them until
    // each cache-and-network query overwrites them.
    it('leaves nothing for a later restore to load', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(
        CACHE_KEY,
        JSON.stringify({
          'PantryItem:1': { __typename: 'PantryItem', id: '1', name: 'Milk' },
        }),
      );
      storage.set(
        CRITICAL_KEY,
        JSON.stringify({ ROOT_QUERY: { __typename: 'Query' } }),
      );
      storage.set(
        DEFERRED_KEY,
        JSON.stringify({
          'ShoppingListItem:9': { __typename: 'ShoppingListItem', id: '9' },
        }),
      );
      // Sanity: the entities are restorable before the clear.
      expect(apolloCachePersistence.load()).not.toBeNull();

      apolloCachePersistence.clear();

      expect(apolloCachePersistence.load()).toBeNull();
      expect(storage.getString(CRITICAL_KEY)).toBeUndefined();
      expect(storage.getString(DEFERRED_KEY)).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('returns exists: false when no cache exists', () => {
      const stats = apolloCachePersistence.getStats();
      expect(stats).toEqual({
        exists: false,
        version: null,
        sizeKB: null,
        entityCount: null,
      });
    });

    it('returns stats from split keys', () => {
      const critical = { ROOT_QUERY: {} };
      const deferred = { 'PantryItem:1': {}, 'PantryItem:2': {} };
      const criticalStr = JSON.stringify(critical);
      const deferredStr = JSON.stringify(deferred);
      storage.set(CRITICAL_KEY, criticalStr);
      storage.set(DEFERRED_KEY, deferredStr);
      storage.set(VERSION_KEY, CURRENT_VERSION);

      const stats = apolloCachePersistence.getStats();
      expect(stats.exists).toBe(true);
      expect(stats.version).toBe(CURRENT_VERSION);
      expect(stats.entityCount).toBe(3);
      expect(stats.sizeKB).toBe(
        Math.round((criticalStr.length + deferredStr.length) / 1024),
      );
    });

    it('falls back to old single key for stats', () => {
      const cacheData = { 'User:1': { id: '1' }, 'User:2': { id: '2' } };
      const cacheString = JSON.stringify(cacheData);
      storage.set(CACHE_KEY, cacheString);
      storage.set(VERSION_KEY, CURRENT_VERSION);

      const stats = apolloCachePersistence.getStats();
      expect(stats.exists).toBe(true);
      expect(stats.version).toBe(CURRENT_VERSION);
      expect(stats.entityCount).toBe(2);
      expect(stats.sizeKB).toBe(Math.round(cacheString.length / 1024));
    });

    it('returns version null when version key missing', () => {
      storage.set(CRITICAL_KEY, '{"a":1}');

      const stats = apolloCachePersistence.getStats();
      expect(stats.exists).toBe(true);
      expect(stats.version).toBeNull();
    });

    it('returns exists: false on corrupted JSON', () => {
      storage.set(CRITICAL_KEY, 'invalid-json');
      storage.set(VERSION_KEY, CURRENT_VERSION);

      const stats = apolloCachePersistence.getStats();
      expect(stats.exists).toBe(false);
    });
  });

  describe('isValid', () => {
    it('returns true when version matches and critical key exists', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CRITICAL_KEY, '{"some":"data"}');

      expect(apolloCachePersistence.isValid()).toBe(true);
    });

    it('returns true when version matches and legacy key exists', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, '{"some":"data"}');

      expect(apolloCachePersistence.isValid()).toBe(true);
    });

    it('returns false when version mismatch', () => {
      storage.set(VERSION_KEY, '0.0.0');
      storage.set(CRITICAL_KEY, '{"some":"data"}');

      expect(apolloCachePersistence.isValid()).toBe(false);
    });

    it('returns false when no cache data', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);

      expect(apolloCachePersistence.isValid()).toBe(false);
    });

    it('returns false on storage error', () => {
      // Direct reassign + restore (not jest.spyOn, whose mockRestore fails to
      // restore the MMKV mock's getString and leaves it throwing for later
      // tests).
      const originalGetString = storage.getString;
      storage.getString = jest.fn(() => {
        throw new Error('storage error');
      });

      expect(apolloCachePersistence.isValid()).toBe(false);

      storage.getString = originalGetString;
    });
  });

  // An install upgrading off the retired split-blob scheme has its cache under
  // the two legacy keys and nothing under the single key. Without the
  // migration its first launch after the upgrade starts from an empty cache —
  // one extra fetch online, and a blank app for someone who is offline at that
  // moment.
  describe('migration: retired split-blob format', () => {
    const seedSplitCache = () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CRITICAL_KEY, JSON.stringify({ ROOT_QUERY: { a: 1 } }));
      storage.set(
        DEFERRED_KEY,
        JSON.stringify({ 'PantryItem:1': { id: '1' } }),
      );
    };

    it('load() merges both legacy blobs when the single key is absent', () => {
      seedSplitCache();

      expect(apolloCachePersistence.load()).toEqual({
        ROOT_QUERY: { a: 1 },
        'PantryItem:1': { id: '1' },
      });
    });

    it('load() migrates from whichever legacy blob exists alone', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CRITICAL_KEY, JSON.stringify({ ROOT_QUERY: { a: 1 } }));

      expect(apolloCachePersistence.load()).toEqual({ ROOT_QUERY: { a: 1 } });
    });

    it('the single key wins once it exists, without reading the legacy blobs', () => {
      seedSplitCache();
      storage.set(CACHE_KEY, JSON.stringify({ 'Recipe:9': { id: '9' } }));

      expect(apolloCachePersistence.load()).toEqual({
        'Recipe:9': { id: '9' },
      });
    });

    it('the next save writes the single key and drops the legacy blobs', () => {
      seedSplitCache();

      apolloCachePersistence.save({ ROOT_QUERY: {}, 'Item:1': {} });
      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      expect(JSON.parse(storage.getString(CACHE_KEY)!)).toEqual({
        ROOT_QUERY: {},
        'Item:1': {},
      });
      expect(storage.getString(CRITICAL_KEY)).toBeUndefined();
      expect(storage.getString(DEFERRED_KEY)).toBeUndefined();
    });

    it('a session end removes the legacy blobs too', () => {
      // Otherwise the previous person's entities sit on disk under a key
      // nothing reads any more, which is worse than leaving them readable —
      // it is invisible.
      seedSplitCache();

      apolloCachePersistence.clear();

      expect(storage.getString(CRITICAL_KEY)).toBeUndefined();
      expect(storage.getString(DEFERRED_KEY)).toBeUndefined();
      expect(apolloCachePersistence.load()).toBeNull();
    });
  });
});
