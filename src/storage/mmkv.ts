import {MMKV} from 'react-native-mmkv';
import {StateStorage} from 'zustand/middleware';

export const STORAGE_KEY = 'sous-chef-storage';

export const storage = new MMKV({
  id: STORAGE_KEY,
  encryptionKey: 'sous-chef-encryption-key', // In a real app, use a more secure key management strategy
});

export const zustandStorage: StateStorage = {
  setItem: (name, value) => {
    return storage.set(name, value);
  },
  getItem: name => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: name => {
    return storage.delete(name);
  },
};

// Cache utilities removed - now using Apollo Client only for server data
