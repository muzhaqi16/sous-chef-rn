import {
  STORAGE_KEY,
  storage,
  zustandStorage,
  getStorage,
  initializeSecureStorage,
} from '../mmkv';

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

  describe('storage (encrypted synchronous proxy)', () => {
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

  describe('initializeSecureStorage', () => {
    it('returns an MMKV instance', async () => {
      const instance = await initializeSecureStorage();
      expect(instance).toBeDefined();
      expect(typeof instance.set).toBe('function');
    });

    it('is idempotent across concurrent and serial calls', async () => {
      const [a, b] = await Promise.all([
        initializeSecureStorage(),
        initializeSecureStorage(),
      ]);
      const c = await initializeSecureStorage();
      expect(a).toBe(b);
      expect(b).toBe(c);
    });
  });

  // The fail-closed init path only runs outside the test fast-path (IS_TEST
  // eagerly creates the instance), so these specs reload the module with
  // NODE_ENV overridden and a rejecting DeviceKeyManager.
  describe('initializeSecureStorage fail-closed behavior', () => {
    const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
      jest.useRealTimers();
      jest.resetModules();
    });

    const loadIsolated = (
      keyImpl: () => Promise<string>,
    ): {
      mmkvModule: typeof import('../mmkv');
      createMMKV: jest.Mock;
      getKey: jest.Mock;
    } => {
      process.env.NODE_ENV = 'development';
      jest.resetModules();
      const { DeviceKeyManager } = jest.requireMock(
        '#/utils/security/deviceKey',
      ) as { DeviceKeyManager: { getDeviceEncryptionKey: jest.Mock } };
      DeviceKeyManager.getDeviceEncryptionKey.mockReset();
      DeviceKeyManager.getDeviceEncryptionKey.mockImplementation(keyImpl);
      const { createMMKV } = jest.requireMock('react-native-mmkv') as {
        createMMKV: jest.Mock;
      };
      createMMKV.mockClear();
      const mmkvModule = require('../mmkv') as typeof import('../mmkv');
      return {
        mmkvModule,
        createMMKV,
        getKey: DeviceKeyManager.getDeviceEncryptionKey,
      };
    };

    it('quarantines to the recovery instance when the key never resolves — primary id is not opened keyless', async () => {
      jest.useFakeTimers();
      const { mmkvModule, createMMKV, getKey } = loadIsolated(() =>
        Promise.reject(new Error('keychain unavailable')),
      );

      const initPromise = mmkvModule.initializeSecureStorage();
      await jest.runAllTimersAsync();
      await initPromise;

      expect(getKey).toHaveBeenCalledTimes(2);
      expect(createMMKV).toHaveBeenCalledTimes(1);
      expect(createMMKV).toHaveBeenCalledWith({
        id: mmkvModule.RECOVERY_STORAGE_KEY,
      });
      expect(createMMKV).not.toHaveBeenCalledWith({
        id: mmkvModule.STORAGE_KEY,
      });
    });

    it('opens the encrypted primary instance when the key resolves on the retry cycle', async () => {
      jest.useFakeTimers();
      let calls = 0;
      const { mmkvModule, createMMKV, getKey } = loadIsolated(() => {
        calls += 1;
        return calls === 1
          ? Promise.reject(new Error('transient'))
          : Promise.resolve('recovered-key');
      });

      const initPromise = mmkvModule.initializeSecureStorage();
      await jest.runAllTimersAsync();
      await initPromise;

      expect(getKey).toHaveBeenCalledTimes(2);
      expect(createMMKV).toHaveBeenCalledTimes(1);
      expect(createMMKV).toHaveBeenCalledWith({
        id: mmkvModule.STORAGE_KEY,
        encryptionKey: 'recovered-key',
      });
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
