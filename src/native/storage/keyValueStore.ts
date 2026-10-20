import type { KeyValueStore } from '#platform/ports';
import {
  initializeSecureStorage,
  isRecoveryStorage,
  isStorageReady,
  openedWithEmptyStore,
  storage,
} from './mmkv';

/**
 * The key-value store over the encrypted MMKV instance. Each member delegates
 * through an arrow, so Metro's inline requires load MMKV at its first use.
 */
export const mmkvKeyValueStore: KeyValueStore = {
  set: (key, value) => storage.set(key, value),
  getString: key => storage.getString(key),
  getNumber: key => storage.getNumber(key),
  getBoolean: key => storage.getBoolean(key),
  contains: key => storage.contains(key),
  remove: key => storage.remove(key),
  getAllKeys: () => storage.getAllKeys(),
  clearAll: () => storage.clearAll(),
  ready: async () => {
    await initializeSecureStorage();
  },
  isReady: () => isStorageReady(),
  isRecovery: () => isRecoveryStorage(),
  openedWithEmptyStore: () => openedWithEmptyStore(),
};
