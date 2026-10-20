import type { StateStorage } from 'zustand/middleware';
import { requirePlatform } from '#platform/install';
import type { KeyValueStore } from '#platform/ports';

const installed = (): KeyValueStore => requirePlatform('keyValueStore');

/**
 * Device storage: the host's key-value store, looked up on each access so
 * importing this reads no platform service. A spy on it lands on the installed
 * store, which outlives a module reset. Reads and writes throw until
 * `storage.ready()` resolves; the host starts opening it before any React code
 * runs, and `zustandStorage` waits for it.
 */
export const storage: KeyValueStore = new Proxy<KeyValueStore>(
  // Never read: every trap forwards to the installed store.
  Object.create(null) as KeyValueStore,
  {
    get: (_target, key): unknown => Reflect.get(installed(), key),
    set: (_target, key, value) => Reflect.set(installed(), key, value),
    has: (_target, key) => Reflect.has(installed(), key),
    deleteProperty: (_target, key) => Reflect.deleteProperty(installed(), key),
    defineProperty: (_target, key, descriptor) =>
      Reflect.defineProperty(installed(), key, descriptor),
    ownKeys: () => Reflect.ownKeys(installed()),
    getOwnPropertyDescriptor: (_target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(installed(), key);
      return descriptor && { ...descriptor, configurable: true };
    },
  },
);

/** Zustand's `persist` storage over device storage. */
export const zustandStorage: StateStorage = {
  setItem: async (name, value) => {
    await storage.ready();
    storage.set(name, value);
  },
  getItem: async name => {
    await storage.ready();
    return storage.getString(name) ?? null;
  },
  removeItem: async name => {
    await storage.ready();
    storage.remove(name);
  },
};
