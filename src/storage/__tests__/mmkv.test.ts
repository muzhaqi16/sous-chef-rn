import { STORAGE_KEY, storage, zustandStorage, getStorage } from '../mmkv';

// Mock DeviceKeyManager
jest.mock('#/utils/security/deviceKey', () => ({
  DeviceKeyManager: {
    getDeviceEncryptionKey: jest.fn(() =>
      Promise.resolve('test-encryption-key'),
    ),
  },
}));

describe('mmkv storage', () => {
  describe('STORAGE_KEY', () => {
    it('exports the correct storage key', () => {
      expect(STORAGE_KEY).toBe('sous-chef-storage');
    });
  });

  describe('storage (legacy synchronous instance)', () => {
    it('is an MMKV instance with expected methods', () => {
      expect(typeof storage.set).toBe('function');
      expect(typeof storage.getString).toBe('function');
      expect(typeof storage.remove).toBe('function');
      expect(typeof storage.contains).toBe('function');
    });

    it('can set and get a string value', () => {
      storage.set('test-key', 'test-value');
      expect(storage.getString('test-key')).toBe('test-value');
    });

    it('can remove a value', () => {
      storage.set('to-delete', 'value');
      expect(storage.getString('to-delete')).toBe('value');
      storage.remove('to-delete');
      expect(storage.getString('to-delete')).toBeUndefined();
    });

    it('returns undefined for non-existent keys', () => {
      expect(storage.getString('nonexistent')).toBeUndefined();
    });
  });

  describe('getStorage', () => {
    it('returns an MMKV instance', async () => {
      const instance = await getStorage();
      expect(instance).toBeDefined();
      expect(typeof instance.set).toBe('function');
      expect(typeof instance.getString).toBe('function');
    });

    it('returns the same instance on subsequent calls (singleton)', async () => {
      const first = await getStorage();
      const second = await getStorage();
      expect(first).toBe(second);
    });
  });

  describe('zustandStorage', () => {
    it('has setItem, getItem, removeItem methods', () => {
      expect(typeof zustandStorage.setItem).toBe('function');
      expect(typeof zustandStorage.getItem).toBe('function');
      expect(typeof zustandStorage.removeItem).toBe('function');
    });

    it('setItem stores a value', async () => {
      await zustandStorage.setItem('zustand-key', 'zustand-value');
      const value = await zustandStorage.getItem('zustand-key');
      expect(value).toBe('zustand-value');
    });

    it('getItem returns null for non-existent keys', async () => {
      const value = await zustandStorage.getItem('nonexistent-zustand');
      expect(value).toBeNull();
    });

    it('removeItem removes a value', async () => {
      await zustandStorage.setItem('to-remove', 'value');
      await zustandStorage.removeItem('to-remove');
      const value = await zustandStorage.getItem('to-remove');
      expect(value).toBeNull();
    });
  });
});
