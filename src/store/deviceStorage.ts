import type { StateStorage } from 'zustand/middleware';
import { requirePlatform } from '#platform/install';
import type { KeyValueStore } from '#platform/ports';

/**
 * Device storage, from the host's key-value store. Reads and writes throw until
 * `storage.ready()` resolves; the host starts opening it before any React code
 * runs, and `zustandStorage` waits for it.
 */
export const storage: KeyValueStore = requirePlatform('keyValueStore');

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
