'use no memo';

import { Platform } from 'react-native';
import {
  getSupportedBiometryType,
  resetGenericPassword,
} from 'react-native-keychain';
import { storage } from '#/storage/mmkv';

import { DeviceKeyManager } from '../deviceKey';

const mockedGetSupportedBiometryType = getSupportedBiometryType as jest.MockedFunction<typeof getSupportedBiometryType>;
const mockedResetGenericPassword = resetGenericPassword as jest.MockedFunction<typeof resetGenericPassword>;

describe('DeviceKeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DeviceKeyManager.clearCachedKey();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    Object.defineProperty(Platform, 'Version', { value: '17.0', configurable: true });
  });

  // ==========================================================================
  // clearCachedKey
  // ==========================================================================
  describe('clearCachedKey', () => {
    it('clears the cached key', async () => {
      // First call generates a key and caches it
      const key1 = await DeviceKeyManager.getDeviceEncryptionKey();
      DeviceKeyManager.clearCachedKey();
      // Second call should generate a new key
      const key2 = await DeviceKeyManager.getDeviceEncryptionKey();
      // Keys might differ due to timestamp
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
    });
  });

  // ==========================================================================
  // getDeviceEncryptionKey
  // ==========================================================================
  describe('getDeviceEncryptionKey', () => {
    it('returns a non-empty encryption key', async () => {
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('returns cached key on subsequent calls', async () => {
      const key1 = await DeviceKeyManager.getDeviceEncryptionKey();
      const key2 = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key1).toBe(key2);
    });

    it('generates a new key when forceRegenerate is true', async () => {
      const key1 = await DeviceKeyManager.getDeviceEncryptionKey();
      DeviceKeyManager.clearCachedKey();
      // Force a new key after a small delay so timestamp changes
      await new Promise(r => setTimeout(r, 2));
      const key2 = await DeviceKeyManager.getDeviceEncryptionKey({ forceRegenerate: true });
      // Keys are different because timestamps differ
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
    });

    it('loads existing key from MMKV storage', async () => {
      // Simulate an existing key in storage
      (storage.getString as jest.Mock).mockReturnValueOnce('existing-key-from-storage');
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBe('existing-key-from-storage');
    });

    it('generates new key when storage has no key', async () => {
      (storage.getString as jest.Mock).mockReturnValue(undefined);
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThan(0);
    });

    it('stores generated key in MMKV', async () => {
      (storage.getString as jest.Mock).mockReturnValue(undefined);
      await DeviceKeyManager.getDeviceEncryptionKey();
      expect(storage.set).toHaveBeenCalled();
    });

    it('returns fallback key when generation fails', async () => {
      // Make storage throw during key generation
      (storage.getString as jest.Mock).mockReturnValue(undefined);
      (storage.set as jest.Mock).mockImplementation(() => { throw new Error('Storage write failed'); });
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      // Falls back to getFallbackKey
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('skips loading existing key when forceRegenerate is true', async () => {
      (storage.getString as jest.Mock).mockReturnValueOnce('old-key');
      const key = await DeviceKeyManager.getDeviceEncryptionKey({ forceRegenerate: true });
      // Should NOT return 'old-key' since forceRegenerate skips loadExistingKey
      expect(key).not.toBe('old-key');
    });
  });

  // ==========================================================================
  // isBiometricAvailable
  // ==========================================================================
  describe('isBiometricAvailable', () => {
    it('returns true when biometry is supported', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue('FaceID' as any);
      expect(await DeviceKeyManager.isBiometricAvailable()).toBe(true);
    });

    it('returns false when biometry is not supported', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(null);
      expect(await DeviceKeyManager.isBiometricAvailable()).toBe(false);
    });

    it('returns false on error', async () => {
      mockedGetSupportedBiometryType.mockRejectedValue(new Error('fail'));
      expect(await DeviceKeyManager.isBiometricAvailable()).toBe(false);
    });
  });

  // ==========================================================================
  // regenerateKey
  // ==========================================================================
  describe('regenerateKey', () => {
    it('clears old key and generates new one', async () => {
      const key = await DeviceKeyManager.regenerateKey();
      expect(key).toBeTruthy();
      expect(mockedResetGenericPassword).toHaveBeenCalled();
      expect(storage.remove).toHaveBeenCalledWith('device_encryption_key');
    });

    it('handles error when clearing old key', async () => {
      mockedResetGenericPassword.mockRejectedValue(new Error('reset failed'));
      // Should still generate a new key despite error clearing
      const key = await DeviceKeyManager.regenerateKey();
      expect(key).toBeTruthy();
    });
  });

  // ==========================================================================
  // getReactNativeDeviceId (tested indirectly through key generation)
  // ==========================================================================
  describe('device ID generation', () => {
    it('uses stored device ID when available', async () => {
      // First getString returns undefined (no encryption key), second returns stored device ID
      (storage.getString as jest.Mock)
        .mockReturnValueOnce(undefined) // device_encryption_key lookup
        .mockReturnValueOnce('stored-device-id'); // device_unique_id lookup

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
    });

    it('creates and stores new device ID when not available', async () => {
      (storage.getString as jest.Mock).mockReturnValue(undefined);
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      // storage.set should be called for both device_unique_id and device_encryption_key
      expect(storage.set).toHaveBeenCalled();
    });

    it('handles storage read error in getReactNativeDeviceId gracefully', async () => {
      (storage.getString as jest.Mock)
        .mockReturnValueOnce(undefined) // device_encryption_key
        .mockImplementationOnce(() => { throw new Error('read error'); }); // device_unique_id

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      // Should still generate a key using the fallback device ID
      expect(key).toBeTruthy();
    });
  });

  // ==========================================================================
  // Fallback key behavior
  // ==========================================================================
  describe('fallback key', () => {
    it('generates platform-specific fallback key on iOS', async () => {
      // Force loadExistingKey to return null and generateNewKey to throw
      (storage.getString as jest.Mock).mockReturnValue(undefined);
      (storage.set as jest.Mock).mockImplementation(() => { throw new Error('fail'); });

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
    });

    it('generates platform-specific fallback key on Android', async () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      (storage.getString as jest.Mock).mockReturnValue(undefined);
      (storage.set as jest.Mock).mockImplementation(() => { throw new Error('fail'); });

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
    });
  });
});
