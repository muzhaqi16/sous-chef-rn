'use no memo';

import { Platform } from 'react-native';
import {
  getSupportedBiometryType,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';
import { storage } from '#/storage/mmkv';

import { DeviceKeyManager } from '../deviceKey';

const mockedGetSupportedBiometryType =
  getSupportedBiometryType as jest.MockedFunction<
    typeof getSupportedBiometryType
  >;
const mockedSetGenericPassword = setGenericPassword as jest.MockedFunction<
  typeof setGenericPassword
>;
const mockedGetGenericPassword = getGenericPassword as jest.MockedFunction<
  typeof getGenericPassword
>;
const mockedResetGenericPassword = resetGenericPassword as jest.MockedFunction<
  typeof resetGenericPassword
>;

describe('DeviceKeyManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    DeviceKeyManager.clearCachedKey();
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    Object.defineProperty(Platform, 'Version', {
      value: '17.0',
      configurable: true,
    });

    // Reset MMKV mock state (including any once-only queued values from prior tests)
    (storage.getString as jest.Mock).mockReset?.();
    (storage.set as jest.Mock).mockReset?.();
    (storage.remove as jest.Mock).mockReset?.();

    // Reset keychain mocks fully — clears any leftover mockResolvedValueOnce
    // queues that were set but never consumed by a prior test.
    mockedGetGenericPassword.mockReset();
    mockedSetGenericPassword.mockReset();
    mockedResetGenericPassword.mockReset();
    mockedGetSupportedBiometryType.mockReset();

    // Default keychain behavior: empty
    mockedGetGenericPassword.mockResolvedValue(false);
    mockedSetGenericPassword.mockResolvedValue({
      service: 'dev.souschef.app.devicekey',
      storage: 'keychain' as any,
    } as any);
    mockedResetGenericPassword.mockResolvedValue(true);
  });

  // ==========================================================================
  // clearCachedKey
  // ==========================================================================
  describe('clearCachedKey', () => {
    it('clears the cached key', async () => {
      await DeviceKeyManager.getDeviceEncryptionKey();
      DeviceKeyManager.clearCachedKey();
      // Second call should regenerate (keychain is now empty in this mock)
      const key2 = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key2).toBeTruthy();
    });
  });

  // ==========================================================================
  // getDeviceEncryptionKey
  // ==========================================================================
  describe('getDeviceEncryptionKey', () => {
    it('returns a non-empty hex encryption key', async () => {
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
      // 32 bytes -> 64 hex chars
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it('returns cached key on subsequent calls', async () => {
      const key1 = await DeviceKeyManager.getDeviceEncryptionKey();
      const key2 = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key1).toBe(key2);
    });

    it('reads existing key from keychain', async () => {
      mockedGetGenericPassword.mockResolvedValueOnce({
        service: 'dev.souschef.app.devicekey',
        username: 'device_key',
        password: 'existing-key-from-keychain',
        storage: 'keychain' as any,
      } as any);

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBe('existing-key-from-keychain');
      expect(mockedSetGenericPassword).not.toHaveBeenCalled();
    });

    it('generates new key when keychain is empty', async () => {
      mockedGetGenericPassword.mockResolvedValue(false);
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBe(64);
      // The new key must be persisted to keychain
      expect(mockedSetGenericPassword).toHaveBeenCalled();
    });

    it('migrates legacy MMKV-stored key to keychain on first launch', async () => {
      mockedGetGenericPassword.mockResolvedValue(false);
      (storage.getString as jest.Mock).mockReturnValueOnce('legacy-mmkv-key');

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBe('legacy-mmkv-key');
      // Key should be migrated to keychain
      expect(mockedSetGenericPassword).toHaveBeenCalledWith(
        'device_key',
        'legacy-mmkv-key',
        expect.any(Object),
      );
      // And the legacy MMKV entry removed
      expect(storage.remove).toHaveBeenCalledWith('device_encryption_key');
    });

    it('returns fallback key when keychain write fails', async () => {
      mockedGetGenericPassword.mockResolvedValue(false);
      mockedSetGenericPassword.mockRejectedValue(
        new Error('Keychain write failed'),
      );

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(typeof key).toBe('string');
    });

    it('skips loading existing key when forceRegenerate is true', async () => {
      mockedGetGenericPassword.mockResolvedValueOnce({
        service: 'dev.souschef.app.devicekey',
        username: 'device_key',
        password: 'old-key',
        storage: 'keychain' as any,
      } as any);

      const key = await DeviceKeyManager.getDeviceEncryptionKey({
        forceRegenerate: true,
      });
      expect(key).not.toBe('old-key');
      expect(key).toMatch(/^[0-9a-f]{64}$/);
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
    it('clears old keychain entry and generates new key', async () => {
      const key = await DeviceKeyManager.regenerateKey();
      expect(key).toBeTruthy();
      expect(mockedResetGenericPassword).toHaveBeenCalled();
      expect(mockedSetGenericPassword).toHaveBeenCalled();
    });

    it('handles error when clearing old keychain entry', async () => {
      mockedResetGenericPassword.mockRejectedValue(new Error('reset failed'));
      const key = await DeviceKeyManager.regenerateKey();
      expect(key).toBeTruthy();
    });

    it('clears any leftover legacy MMKV entry on regenerate', async () => {
      await DeviceKeyManager.regenerateKey();
      expect(storage.remove).toHaveBeenCalledWith('device_encryption_key');
    });
  });

  // ==========================================================================
  // Fallback key behavior
  // ==========================================================================
  describe('fallback key', () => {
    it('returns a fallback key on iOS when keychain fails', async () => {
      mockedGetGenericPassword.mockRejectedValue(new Error('keychain dead'));
      mockedSetGenericPassword.mockRejectedValue(
        new Error('keychain write dead'),
      );

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThanOrEqual(16);
    });

    it('returns a fallback key on Android when keychain fails', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      mockedGetGenericPassword.mockRejectedValue(new Error('keychain dead'));
      mockedSetGenericPassword.mockRejectedValue(
        new Error('keychain write dead'),
      );

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBeGreaterThanOrEqual(16);
    });
  });
});
