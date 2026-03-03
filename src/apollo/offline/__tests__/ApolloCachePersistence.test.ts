'use no memo';

import { storage } from '#storage/mmkv';
import { apolloCachePersistence } from '../ApolloCachePersistence';

const CACHE_KEY = 'apollo-cache-v1';
const VERSION_KEY = 'apollo-cache-version';
const CURRENT_VERSION = '1.1.3';

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
      const cacheData = { ROOT_QUERY: { __typename: 'Query' }, 'User:1': { id: '1' } };
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

    it('saves after debounce period elapses', () => {
      const cache = { ROOT_QUERY: { __typename: 'Query' } };
      apolloCachePersistence.save(cache);

      // Advance past debounce (3000ms)
      jest.advanceTimersByTime(3000);
      // The serialize runs via requestIdleCallback/requestAnimationFrame fallback
      jest.runAllTimers();

      expect(storage.getString(CACHE_KEY)).toBe(JSON.stringify(cache));
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
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

      // Only the last cache should be saved
      expect(storage.getString(CACHE_KEY)).toBe(JSON.stringify({ c: 3 }));
    });
  });

  describe('saveImmediate', () => {
    it('persists immediately without debounce', () => {
      const cache = { ROOT_QUERY: { __typename: 'Query' } };
      apolloCachePersistence.saveImmediate(cache);

      expect(storage.getString(CACHE_KEY)).toBe(JSON.stringify(cache));
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
    });

    it('cancels any pending debounced save', () => {
      apolloCachePersistence.save({ old: true } as any);
      apolloCachePersistence.saveImmediate({ immediate: true } as any);

      // Advance timers to ensure debounced save does not fire
      jest.runAllTimers();

      expect(storage.getString(CACHE_KEY)).toBe(
        JSON.stringify({ immediate: true }),
      );
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
      apolloCachePersistence.save({ deferred: true } as any);
      apolloCachePersistence.resume();

      jest.advanceTimersByTime(3000);
      jest.runAllTimers();

      expect(storage.getString(CACHE_KEY)).toBe(
        JSON.stringify({ deferred: true }),
      );
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
      expect(storage.getString(CACHE_KEY)).toBe(
        JSON.stringify({ second: true }),
      );
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
    it('removes cache data and version from storage', () => {
      storage.set(CACHE_KEY, '{"data":"old"}');
      storage.set(VERSION_KEY, CURRENT_VERSION);

      apolloCachePersistence.clear();

      expect(storage.getString(CACHE_KEY)).toBeUndefined();
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

    it('returns stats when cache exists', () => {
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
      storage.set(CACHE_KEY, '{"a":1}');

      const stats = apolloCachePersistence.getStats();
      expect(stats.exists).toBe(true);
      expect(stats.version).toBeNull();
    });

    it('returns exists: false on corrupted JSON', () => {
      storage.set(CACHE_KEY, 'invalid-json');
      storage.set(VERSION_KEY, CURRENT_VERSION);

      const stats = apolloCachePersistence.getStats();
      expect(stats.exists).toBe(false);
    });
  });

  describe('isValid', () => {
    it('returns true when version matches and cache data exists', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, '{"some":"data"}');

      expect(apolloCachePersistence.isValid()).toBe(true);
    });

    it('returns false when version mismatch', () => {
      storage.set(VERSION_KEY, '0.0.0');
      storage.set(CACHE_KEY, '{"some":"data"}');

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
});
