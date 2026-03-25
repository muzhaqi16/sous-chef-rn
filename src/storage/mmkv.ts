import { createMMKV, type MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import { DeviceKeyManager } from '#/utils/security/deviceKey';

export const STORAGE_KEY = 'sous-chef-storage';

// Initialize storage with device-specific encryption key
let secureStorageInstance: MMKV | null = null;

/**
 * Get the securely initialized MMKV storage instance
 */
export const getStorage = async (): Promise<MMKV> => {
  if (secureStorageInstance) {
    return secureStorageInstance;
  }

  try {
    const encryptionKey = await DeviceKeyManager.getDeviceEncryptionKey();
    secureStorageInstance = createMMKV({
      id: STORAGE_KEY,
      encryptionKey,
      compareBeforeSet: true,
    });
    return secureStorageInstance;
  } catch (error) {
    console.error('Failed to initialize secure storage:', error);
    // Fallback to unencrypted storage (logged for monitoring)
    console.warn('WARNING: Using unencrypted storage as fallback');
    secureStorageInstance = createMMKV({
      id: STORAGE_KEY,
      compareBeforeSet: true,
    });
    return secureStorageInstance;
  }
};

// Legacy synchronous storage for immediate use (will be migrated)
export const storage = createMMKV({
  id: STORAGE_KEY + '_temp',
  compareBeforeSet: true,
  // Note: This temporary instance will be migrated to secure storage
});

export const zustandStorage: StateStorage = {
  setItem: async (name, value) => {
    try {
      const secureStorage = await getStorage();
      return secureStorage.set(name, value);
    } catch (error) {
      console.error('Failed to set item in secure storage:', error);
      // Fallback to temporary storage
      return storage.set(name, value);
    }
  },
  getItem: async name => {
    try {
      const secureStorage = await getStorage();
      const value = secureStorage.getString(name);
      return value ?? null;
    } catch (error) {
      console.error('Failed to get item from secure storage:', error);
      // Fallback to temporary storage
      const value = storage.getString(name);
      return value ?? null;
    }
  },
  removeItem: async name => {
    try {
      const secureStorage = await getStorage();
      return secureStorage.remove(name);
    } catch (error) {
      console.error('Failed to remove item from secure storage:', error);
      // Fallback to temporary storage
      return storage.remove(name);
    }
  },
};

// Cache utilities removed - now using Apollo Client only for server data
