'use no memo';

import {
  gql,
  type NormalizedCacheObject,
  type StoreObject,
} from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { storage } from '#storage/mmkv';
import { apolloCachePersistence } from '../ApolloCachePersistence';
import { logger } from '#/utils/environment';

const CACHE_KEY = 'apollo-cache-v1';
const VERSION_KEY = 'apollo-cache-version';
const LEGACY_KEYS = ['apollo-cache-v1-critical', 'apollo-cache-v1-deferred'];
// Identifies the shape of a persisted blob, not the app version that wrote it
// — `CURRENT_CACHE_VERSION` in ApolloCachePersistence. Keep in step with it.
const CURRENT_VERSION = 'shape-2';

const schedule = (cache: NormalizedCacheObject) =>
  apolloCachePersistence.scheduleExtractAndSave(() => cache);

/** Past the 3s debounce, then the idle callback (a `setTimeout(0)` in Jest). */
const settle = () => {
  jest.advanceTimersByTime(3000);
  jest.runAllTimers();
};

const persisted = () => JSON.parse(storage.getString(CACHE_KEY)!);

describe('ApolloCachePersistence', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    storage.clearAll();
    // Also drops the singleton's last-persisted snapshot, which would otherwise
    // let a flush skip a write the previous test already made.
    apolloCachePersistence.clear();
  });

  afterEach(() => {
    apolloCachePersistence.cancel();
    jest.useRealTimers();
  });

  describe('load', () => {
    it('returns null when no cache version is stored', () => {
      expect(apolloCachePersistence.load()).toBeNull();
    });

    it('returns null and clears when version mismatch', () => {
      storage.set(VERSION_KEY, '0.0.0');
      storage.set(CACHE_KEY, '{"old":"data"}');

      expect(apolloCachePersistence.load()).toBeNull();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      expect(storage.getString(VERSION_KEY)).toBeUndefined();
    });

    it('returns null when no cache data exists but version matches', () => {
      storage.set(VERSION_KEY, CURRENT_VERSION);

      expect(apolloCachePersistence.load()).toBeNull();
    });

    it('returns parsed cache when version matches and data exists', () => {
      const cacheData = {
        ROOT_QUERY: { __typename: 'Query' },
        'User:1': { id: '1' },
      };
      storage.set(VERSION_KEY, CURRENT_VERSION);
      storage.set(CACHE_KEY, JSON.stringify(cacheData));

      expect(apolloCachePersistence.load()).toEqual(cacheData);
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

      expect(apolloCachePersistence.load()).toBeNull();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });
  });

  describe('scheduleExtractAndSave', () => {
    it('does not save immediately', () => {
      schedule({ ROOT_QUERY: {} });

      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('saves the whole cache under one key after the debounce elapses', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'PantryItem:1': { id: '1', __typename: 'PantryItem' },
      };
      schedule(cache);
      settle();

      expect(persisted()).toEqual(cache);
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
    });

    it('debounces multiple rapid saves', () => {
      schedule({ 'A:1': { id: '1' } });
      jest.advanceTimersByTime(1000);
      schedule({ 'B:2': { id: '2' } });
      jest.advanceTimersByTime(1000);
      schedule({ 'C:3': { id: '3' } });
      settle();

      expect(persisted()).toEqual({ 'C:3': { id: '3' } });
    });

    it('runs the extractor once per window', () => {
      const extractor = jest.fn(() => ({ 'A:1': { id: '1' } }));
      apolloCachePersistence.scheduleExtractAndSave(extractor);
      apolloCachePersistence.scheduleExtractAndSave(extractor);
      settle();

      expect(extractor).toHaveBeenCalledTimes(1);
    });
  });

  describe('change detection', () => {
    it('persists a change that only altered an entity’s values', () => {
      // `cache.write` for a query result reports only ROOT_QUERY as dirty, and
      // ROOT_QUERY holds `__ref` pointers — so when a refetch brings new field
      // values for entities already cached, its identity and the key count are
      // both unchanged. Read as "nothing changed", the next cold start restores
      // the previous values.
      const rootQuery = { 'pantryItem({})': { __ref: 'PantryItem:1' } };

      schedule({
        ROOT_QUERY: rootQuery,
        'PantryItem:1': { __typename: 'PantryItem', id: '1', name: 'Old' },
      });
      settle();
      expect(storage.getString(CACHE_KEY)).toContain('Old');

      // Same ROOT_QUERY object, same key count, new entity object — exactly
      // what Apollo produces for a refetch over a cached entity.
      schedule({
        ROOT_QUERY: rootQuery,
        'PantryItem:1': { __typename: 'PantryItem', id: '1', name: 'New' },
      });
      settle();

      expect(storage.getString(CACHE_KEY)).toContain('New');
      expect(storage.getString(CACHE_KEY)).not.toContain('Old');
    });

    // The real shape is two separate `extract()` calls off an unchanged cache:
    // every entity keeps its reference, and `__META` is a fresh object literal
    // each time (`entityStore.extract`) — comparing it makes the skip
    // unreachable.
    it('skips a save when two extracts of an unchanged cache match', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'Unit:u1',
        fragment: gql`
          fragment PersistProbe on Unit {
            id
            name
          }
        `,
        data: { __typename: 'Unit', id: 'u1', name: 'gram' },
      });
      const first = cache.extract();
      expect(Object.keys(first)).toContain('__META');

      schedule(first);
      settle();

      const debugSpy = jest.spyOn(logger, 'debug');
      schedule(cache.extract());
      settle();

      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('skipped'));
      debugSpy.mockRestore();
    });

    it('does not skip when only the retained-root set changed', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'Unit:u1',
        fragment: gql`
          fragment PersistProbePin on Unit {
            id
            name
          }
        `,
        data: { __typename: 'Unit', id: 'u1', name: 'gram' },
      });
      schedule(cache.extract());
      settle();

      // Releasing drops the pin and leaves every entity key untouched, so the
      // identity scan alone cannot tell the two extracts apart.
      cache.release('Unit:u1');
      const debugSpy = jest.spyOn(logger, 'debug');
      schedule(cache.extract());
      settle();

      expect(debugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('skipped'),
      );
      debugSpy.mockRestore();
    });

    it('does not persist a pin whose entity is gone', () => {
      const cache = makeCache();
      cache.writeFragment({
        id: 'Unit:u1',
        fragment: gql`
          fragment PersistProbeDead on Unit {
            id
            name
          }
        `,
        data: { __typename: 'Unit', id: 'u1', name: 'gram' },
      });
      // Evicting takes the entity and leaves the write-time retain behind;
      // `restore()` would re-establish it on every launch.
      cache.evict({ id: 'Unit:u1' });
      const extract = cache.extract();
      expect(extract.__META?.extraRootIds).toContain('Unit:u1');

      schedule(extract);
      settle();

      expect(persisted().__META?.extraRootIds ?? []).not.toContain('Unit:u1');
    });

    it('does not skip once an entity actually changed', () => {
      const cache = makeCache();
      const fragment = gql`
        fragment PersistProbe2 on Unit {
          id
          name
        }
      `;
      cache.writeFragment({
        id: 'Unit:u1',
        fragment,
        data: { __typename: 'Unit', id: 'u1', name: 'gram' },
      });
      schedule(cache.extract());
      settle();

      cache.writeFragment({
        id: 'Unit:u1',
        fragment,
        data: { __typename: 'Unit', id: 'u1', name: 'kilogram' },
      });
      schedule(cache.extract());
      settle();

      expect(storage.getString(CACHE_KEY)).toContain('kilogram');
    });

    it('persists an entity added without any other change', () => {
      const rootQuery = { __typename: 'Query' };
      schedule({ ROOT_QUERY: rootQuery });
      settle();

      schedule({
        ROOT_QUERY: rootQuery,
        'PantryItem:2': { __typename: 'PantryItem', id: '2' },
      });
      settle();

      expect(storage.getString(CACHE_KEY)).toContain('PantryItem:2');
    });

    it('persists an entity removed without any other change', () => {
      const rootQuery = { __typename: 'Query' };
      schedule({
        ROOT_QUERY: rootQuery,
        'PantryItem:3': { __typename: 'PantryItem', id: '3' },
      });
      settle();
      expect(storage.getString(CACHE_KEY)).toContain('PantryItem:3');

      schedule({ ROOT_QUERY: rootQuery });
      settle();

      expect(storage.getString(CACHE_KEY)).not.toContain('PantryItem:3');
    });
  });

  describe('flushPending', () => {
    it('writes a pending debounced save immediately', () => {
      const cache = {
        ROOT_QUERY: { __typename: 'Query' },
        'Recipe:1': { id: '1' },
      };
      schedule(cache);
      expect(storage.getString(CACHE_KEY)).toBeUndefined();

      apolloCachePersistence.flushPending();

      expect(persisted()).toEqual(cache);
      expect(storage.getString(VERSION_KEY)).toBe(CURRENT_VERSION);
    });

    it('writes the latest of several scheduled saves, once', () => {
      schedule({ 'Old:1': { id: '1' } });
      schedule({ 'Latest:1': { id: '1' } });

      apolloCachePersistence.flushPending();
      jest.runAllTimers();

      expect(persisted()).toEqual({ 'Latest:1': { id: '1' } });
    });

    it('is a no-op (and skips extraction) when nothing is pending', () => {
      const extractor = jest.fn(() => ({}));
      apolloCachePersistence.scheduleExtractAndSave(extractor);
      apolloCachePersistence.cancel();

      apolloCachePersistence.flushPending();

      expect(extractor).not.toHaveBeenCalled();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    // A save that has already reached disk owes nothing: a background transition
    // after it must not extract and stringify the whole cache again.
    it('does not run the extractor once the pending save has settled', () => {
      const extractor = jest.fn(() => ({ 'A:1': { id: '1' } }));
      apolloCachePersistence.scheduleExtractAndSave(extractor);
      settle();
      expect(extractor).toHaveBeenCalledTimes(1);

      apolloCachePersistence.flushPending();

      expect(extractor).toHaveBeenCalledTimes(1);
    });

    it('handles serialization errors gracefully', () => {
      const circular: StoreObject = {};
      circular.self = circular;
      schedule({ 'Circular:1': circular });

      expect(() => apolloCachePersistence.flushPending()).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('pause / resume', () => {
    // A write made on a pushed screen is as durable as one made on a tab root.
    // Pausing only widens the window; a pause that persisted nothing lost that
    // screen's writes to an app kill.
    it('still saves while paused, on the wider window', () => {
      apolloCachePersistence.pause();
      schedule({ 'Paused:1': { id: '1' } });

      jest.advanceTimersByTime(3000);
      expect(storage.getString(CACHE_KEY)).toBeUndefined();

      jest.runAllTimers();
      expect(persisted()).toEqual({ 'Paused:1': { id: '1' } });
    });

    it('re-arms a pending save at the tight window on resume', () => {
      apolloCachePersistence.pause();
      schedule({ 'PausedData:1': { id: '1' } });
      apolloCachePersistence.resume();
      settle();

      expect(persisted()).toEqual({ 'PausedData:1': { id: '1' } });
    });

    it('does nothing on resume if nothing was queued while paused', () => {
      apolloCachePersistence.pause();
      apolloCachePersistence.resume();

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('resume is a no-op when not paused', () => {
      apolloCachePersistence.resume();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });

    it('keeps a pending debounced save when pausing', () => {
      schedule({ 'BeforePause:1': { id: '1' } });
      // The timer already installed still runs — cancelling it dropped the
      // write the user had already made.
      jest.advanceTimersByTime(1000);
      apolloCachePersistence.pause();

      jest.runAllTimers();
      expect(persisted()).toEqual({ 'BeforePause:1': { id: '1' } });
    });

    // `flushPending` runs on the background transition and must cover exactly
    // the screens the pause covers.
    it('flushes a write made while paused when the app backgrounds', () => {
      apolloCachePersistence.pause();
      schedule({ 'PausedFlush:1': { id: '1' } });
      apolloCachePersistence.flushPending();

      expect(persisted()).toEqual({ 'PausedFlush:1': { id: '1' } });
    });

    it('uses the latest extractor when multiple saves happen while paused', () => {
      apolloCachePersistence.pause();
      schedule({ 'First:1': { id: '1' } });
      schedule({ 'Second:2': { id: '2' } });
      apolloCachePersistence.resume();
      settle();

      expect(persisted()).toEqual({ 'Second:2': { id: '2' } });
    });
  });

  describe('cancel', () => {
    it('cancels pending debounced save', () => {
      schedule({ 'ShouldCancel:1': { id: '1' } });
      apolloCachePersistence.cancel();

      jest.runAllTimers();
      expect(storage.getString(CACHE_KEY)).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes every cache key, the retired split keys included', () => {
      // Nothing writes the split keys any more; an install that still holds
      // them must not keep the previous person's entities under a key nothing
      // reads — that is worse than leaving them readable, it is invisible.
      storage.set(CACHE_KEY, '{"data":"old"}');
      storage.set(VERSION_KEY, CURRENT_VERSION);
      for (const key of LEGACY_KEYS) storage.set(key, '{"ROOT_QUERY":{}}');

      apolloCachePersistence.clear();

      expect(storage.getString(CACHE_KEY)).toBeUndefined();
      expect(storage.getString(VERSION_KEY)).toBeUndefined();
      for (const key of LEGACY_KEYS) {
        expect(storage.getString(key)).toBeUndefined();
      }
    });

    it('cancels pending saves', () => {
      schedule({ 'BeforeClear:1': { id: '1' } });
      apolloCachePersistence.clear();

      jest.runAllTimers();
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
      expect(apolloCachePersistence.load()).not.toBeNull();

      apolloCachePersistence.clear();

      expect(apolloCachePersistence.load()).toBeNull();
    });
  });
});
