'use no memo';

import { storage } from '#storage/mmkv';
import { apolloCachePersistence } from '../ApolloCachePersistence';

const CACHE_KEY = 'apollo-cache-v1';
const CRITICAL_KEY = 'apollo-cache-v1-critical';
const DEFERRED_KEY = 'apollo-cache-v1-deferred';
const VERSION_KEY = 'apollo-cache-version';
const CURRENT_VERSION = '1.0.0'; // Matches jest.setup.js mock of getVersion()

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

    it('saves after debounce period elapses (split keys)', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'PantryItem:1': { id: '1', __typename: 'PantryItem' },
      };
      apolloCachePersistence.save(cache);

      // Advance past debounce (3000ms)
      jest.advanceTimersByTime(3000);
      // The serialize runs via requestIdleCallback/requestAnimationFrame fallback
      jest.runAllTimers();

      // Critical key should have ROOT_QUERY
      const critical = JSON.parse(storage.getString(CRITICAL_KEY)!);
      expect(critical).toEqual({ ROOT_QUERY: { __typename: 'Query' } });

      // Deferred key should have PantryItem
      const deferred = JSON.parse(storage.getString(DEFERRED_KEY)!);
      expect(deferred).toEqual({
        'PantryItem:1': { id: '1', __typename: 'PantryItem' },
      });

      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
      // Old single key should be removed
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('debounces multiple rapid saves', () => {
      apolloCachePersistence.save({ a: 1 } as any);
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.save({ b: 2 } as any);
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.save({ c: 3 } as any);

      // Advance fully
      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      // Only the last cache should be saved (all deferred since no critical typenames)
      const deferred = JSON.parse(storage.getString(DEFERRED_KEY)!);
      expect(deferred).toEqual({ c: 3 });
    });
  });

  describe('saveImmediate', () => {
    it('persists immediately without debounce (split keys)', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'Recipe:1': { id: '1' },
      };
      apolloCachePersistence.saveImmediate(cache);

      const critical = JSON.parse(storage.getString(CRITICAL_KEY)!);
      expect(critical).toEqual({ ROOT_QUERY: { __typename: 'Query' } });

      const deferred = JSON.parse(storage.getString(DEFERRED_KEY)!);
      expect(deferred).toEqual({ 'Recipe:1': { id: '1' } });

      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
      // Old key removed
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('cancels any pending debounced save', () => {
      apolloCachePersistence.save({ old: true } as any);
      apolloCachePersistence.saveImmediate({ immediate: true } as any);

      // Advance timers to ensure debounced save does not fire
      jest.runAllTimers();

      const deferred = JSON.parse(storage.getString(DEFERRED_KEY)!);
      expect(deferred).toEqual({ immediate: true });
    });

    it('handles serialization errors gracefully', () => {
      const circular: any = {};
      circular.self = circular;

      // Should not throw
      apolloCachePersistence.saveImmediate(circular);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('pause / resume', () => {
    it('suppresses saves while paused', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.save({ paused: true } as any);

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('flushes pending save on resume', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.save({ pausedData: true } as any);
      apolloCachePersistence.resume();

      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      const deferred = JSON.parse(storage.getString(DEFERRED_KEY)!);
      expect(deferred).toEqual({ pausedData: true });
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
      apolloCachePersistence.save({ before_pause: true } as any);
      // Pause before debounce fires
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.pause();

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('uses the latest extractor when multiple saves happen while paused', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.save({ first: true } as any);
      apolloCachePersistence.save({ second: true } as any);
      apolloCachePersistence.resume();

      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      // The last extractor should win
      const deferred = JSON.parse(storage.getString(DEFERRED_KEY)!);
      expect(deferred).toEqual({ second: true });
    });
  });

  describe('cancel', () => {
    it('cancels pending debounced save', () => {
      apolloCachePersistence.save({ should_cancel: true } as any);
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
      expect(storage.getString(CRITICAL_KEY)).toBeUndefined();
      expect(storage.getString(DEFERRED_KEY)).toBeUndefined();
      expect(storage.getString(VERSION_KEY)).toBeUndefined();
    });

    it('cancels pending saves', () => {
      apolloCachePersistence.save({ before_clear: true } as any);
      apolloCachePersistence.clear();

      jest.runAllTimers();
      // Cache should remain cleared, not re-populated by the debounced save
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
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
      const originalGetString = storage.getString;
      (storage as any).getString = jest.fn(() => {
        throw new Error('storage error');
      });

      expect(apolloCachePersistence.isValid()).toBe(false);

      (storage as any).getString = originalGetString;
    });
  });

  describe('partitionCache', () => {
    it('classifies ROOT_QUERY as critical', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'PantryItem:1': { id: '1' },
      };
      const { critical, deferred } =
        apolloCachePersistence.partitionCache(cache);
      expect(critical).toHaveProperty('ROOT_QUERY');
      expect(deferred).not.toHaveProperty('ROOT_QUERY');
    });

    it('classifies ROOT_MUTATION and __META as critical', () => {
      const cache = {
        ROOT_MUTATION: {},
        ROOT_SUBSCRIPTION: {},
        __META: { extraRootIds: [] },
        'Recipe:1': { id: '1' },
      };
      const { critical, deferred } =
        apolloCachePersistence.partitionCache(cache);
      expect(Object.keys(critical)).toEqual(
        expect.arrayContaining([
          'ROOT_MUTATION',
          'ROOT_SUBSCRIPTION',
          '__META',
        ]),
      );
      expect(deferred).toEqual({ 'Recipe:1': { id: '1' } });
    });

    it('classifies User and Home typenames as critical', () => {
      const cache = {
        'User:1': { id: '1', __typename: 'User' },
        'Home:1': { id: '1', __typename: 'Home' },
        'UserSettings:1': { __typename: 'UserSettings' },
        'DietaryProfile:1': { __typename: 'DietaryProfile' },
        'ShoppingListItem:5': { id: '5' },
      };
      const { critical, deferred } =
        apolloCachePersistence.partitionCache(cache);
      expect(Object.keys(critical).sort()).toEqual([
        'DietaryProfile:1',
        'Home:1',
        'User:1',
        'UserSettings:1',
      ]);
      expect(deferred).toEqual({ 'ShoppingListItem:5': { id: '5' } });
    });

    it('classifies PantryItem, ShoppingListItem, Recipe as deferred', () => {
      const cache = {
        'PantryItem:1': { id: '1' },
        'ShoppingListItem:2': { id: '2' },
        'Recipe:3': { id: '3' },
        'Brand:4': { id: '4' },
        'Category:5': { id: '5' },
      };
      const { critical, deferred } =
        apolloCachePersistence.partitionCache(cache);
      expect(Object.keys(critical)).toHaveLength(0);
      expect(Object.keys(deferred)).toHaveLength(5);
    });

    it('defaults unknown typenames to deferred', () => {
      const cache = {
        'SomeNewType:1': { id: '1' },
        ROOT_QUERY: {},
      };
      const { critical, deferred } =
        apolloCachePersistence.partitionCache(cache);
      expect(critical).toEqual({ ROOT_QUERY: {} });
      expect(deferred).toEqual({ 'SomeNewType:1': { id: '1' } });
    });
  });

  describe('loadCritical', () => {
    it('returns null when no critical key exists', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      expect(apolloCachePersistence.loadCritical()).toBeNull();
    });

    it('returns null on version mismatch', () => {
      storage.set(VERSION_KEY, '0.0.0');
      storage.set(CRITICAL_KEY, '{"ROOT_QUERY":{}}');
      expect(apolloCachePersistence.loadCritical()).toBeNull();
    });

    it('returns critical entities when available', () => {
      const criticalData = { ROOT_QUERY: {}, 'User:1': { id: '1' } };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CRITICAL_KEY, JSON.stringify(criticalData));

      expect(apolloCachePersistence.loadCritical()).toEqual(criticalData);
    });

    it('returns null on corrupted JSON', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CRITICAL_KEY, 'bad-json{{{');
      expect(apolloCachePersistence.loadCritical()).toBeNull();
    });
  });

  describe('loadDeferred', () => {
    it('returns null when no deferred key exists', () => {
      expect(apolloCachePersistence.loadDeferred()).toBeNull();
    });

    it('returns deferred entities when available', () => {
      const deferredData = {
        'PantryItem:1': { id: '1' },
        'Recipe:2': { id: '2' },
      };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(DEFERRED_KEY, JSON.stringify(deferredData));

      expect(apolloCachePersistence.loadDeferred()).toEqual(deferredData);
    });

    it('returns null on corrupted JSON', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(DEFERRED_KEY, 'bad-json');
      expect(apolloCachePersistence.loadDeferred()).toBeNull();
    });

    it('returns null when version key is missing (crash-mid-clear guard)', () => {
      const deferredData = { 'PantryItem:1': { id: '1' } };
      storage.set(DEFERRED_KEY, JSON.stringify(deferredData));
      // No VERSION_KEY set — simulates a partial clear where deferred
      // survived but version did not.
      expect(apolloCachePersistence.loadDeferred()).toBeNull();
    });

    it('returns null on version mismatch', () => {
      const deferredData = { 'PantryItem:1': { id: '1' } };
      storage.set(VERSION_KEY, '0.0.1');
      storage.set(DEFERRED_KEY, JSON.stringify(deferredData));
      expect(apolloCachePersistence.loadDeferred()).toBeNull();
    });
  });

  describe('restoreDeferred', () => {
    // requestIdleCallback is polyfilled in __tests__/setup/globals.js as
    // setTimeout(cb, 0), so advancing timers fires the idle callback.
    const makeFakeCache = () => ({ restore: jest.fn() });

    it('schedules an idle callback and restores deferred entities into the cache', () => {
      const deferredData = {
        'PantryItem:1': { id: '1' },
        'Recipe:2': { id: '2' },
      };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(DEFERRED_KEY, JSON.stringify(deferredData));

      const cache = makeFakeCache();
      apolloCachePersistence.restoreDeferred(cache as any);

      // Idle callback hasn't fired yet
      expect(cache.restore).not.toHaveBeenCalled();

      jest.advanceTimersByTime(0);

      expect(cache.restore).toHaveBeenCalledWith(deferredData);
    });

    it('does nothing when there are no deferred entities to restore', () => {
      const cache = makeFakeCache();
      apolloCachePersistence.restoreDeferred(cache as any);

      jest.advanceTimersByTime(0);

      expect(cache.restore).not.toHaveBeenCalled();
    });

    it('cancel() aborts a pending restore so logout cannot race with idle fire', () => {
      const deferredData = { 'PantryItem:1': { id: '1' } };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(DEFERRED_KEY, JSON.stringify(deferredData));

      const cache = makeFakeCache();
      apolloCachePersistence.restoreDeferred(cache as any);
      apolloCachePersistence.cancel();

      jest.advanceTimersByTime(0);

      expect(cache.restore).not.toHaveBeenCalled();
    });

    it('cancels a prior in-flight restore when called twice', () => {
      const deferredData = { 'PantryItem:1': { id: '1' } };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(DEFERRED_KEY, JSON.stringify(deferredData));

      const cache1 = makeFakeCache();
      const cache2 = makeFakeCache();
      apolloCachePersistence.restoreDeferred(cache1 as any);
      apolloCachePersistence.restoreDeferred(cache2 as any);

      jest.advanceTimersByTime(0);

      // Only the second call wins
      expect(cache1.restore).not.toHaveBeenCalled();
      expect(cache2.restore).toHaveBeenCalledWith(deferredData);
    });
  });

  describe('migration: old single-key format', () => {
    it('load() still reads old single-key format', () => {
      const cacheData = { ROOT_QUERY: {}, 'PantryItem:1': { id: '1' } };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, JSON.stringify(cacheData));

      expect(apolloCachePersistence.load()).toEqual(cacheData);
    });

    it('save migrates away from old key by deleting it', () => {
      // Pre-populate old key
      storage.set(CACHE_KEY, '{"old":"data"}');

      apolloCachePersistence.save({ ROOT_QUERY: {}, 'Item:1': {} } as any);
      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      // Old key should be removed after save
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      // New keys should exist
      expect(storage.getString(CRITICAL_KEY)).toBeDefined();
      expect(storage.getString(DEFERRED_KEY)).toBeDefined();
    });
  });
});
