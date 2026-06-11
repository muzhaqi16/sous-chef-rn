'use no memo';

import { Platform } from 'react-native';
import {
  getSupportedBiometryType,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';
import type { STORAGE_TYPE, BIOMETRY_TYPE } from 'react-native-keychain';

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
      storage: 'keychain' as STORAGE_TYPE,
    });
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
      // UUID v4 without dashes -> 32 hex chars
      expect(key).toMatch(/^[0-9a-f]{32}$/);
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
        storage: 'keychain' as STORAGE_TYPE,
      });

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBe('existing-key-from-keychain');
      expect(mockedSetGenericPassword).not.toHaveBeenCalled();
    });

    it('generates new key when keychain is empty', async () => {
      mockedGetGenericPassword.mockResolvedValue(false);
      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBeTruthy();
      expect(key.length).toBe(32);
      // The new key must be persisted to keychain
      expect(mockedSetGenericPassword).toHaveBeenCalled();
    });

    it('throws (fail closed) after retries when keychain write fails', async () => {
      mockedGetGenericPassword.mockResolvedValue(false);
      mockedSetGenericPassword.mockRejectedValue(
        new Error('Keychain write failed'),
      );

      await expect(DeviceKeyManager.getDeviceEncryptionKey()).rejects.toThrow(
        'Failed to persist device key to keychain',
      );
      // 3 attempts × (hardware + software write) = 6 keychain writes
      expect(mockedSetGenericPassword).toHaveBeenCalledTimes(6);
    });

    it('skips loading existing key when forceRegenerate is true', async () => {
      mockedGetGenericPassword.mockResolvedValueOnce({
        service: 'dev.souschef.app.devicekey',
        username: 'device_key',
        password: 'old-key',
        storage: 'keychain' as STORAGE_TYPE,
      });

      const key = await DeviceKeyManager.getDeviceEncryptionKey({
        forceRegenerate: true,
      });
      expect(key).not.toBe('old-key');
      expect(key).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  // ==========================================================================
  // isBiometricAvailable
  // ==========================================================================
  describe('isBiometricAvailable', () => {
    it('returns true when biometry is supported', async () => {
      mockedGetSupportedBiometryType.mockResolvedValue(
        'FaceID' as BIOMETRY_TYPE,
      );
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
  });

  // ==========================================================================
  // Fail-closed behavior (no fallback key — a predictable key would be
  // encryption theater; the caller in mmkv.ts handles the throw)
  // ==========================================================================
  describe('fail-closed behavior', () => {
    it('throws when keychain reads keep failing (no fallback key)', async () => {
      mockedGetGenericPassword.mockRejectedValue(new Error('keychain dead'));
      mockedSetGenericPassword.mockRejectedValue(
        new Error('keychain write dead'),
      );

      await expect(DeviceKeyManager.getDeviceEncryptionKey()).rejects.toThrow(
        'keychain dead',
      );
      expect(mockedGetGenericPassword).toHaveBeenCalledTimes(3);
    });

    it('recovers the existing key when a transient read error clears on retry', async () => {
      mockedGetGenericPassword
        .mockRejectedValueOnce(new Error('transient keychain error'))
        .mockResolvedValueOnce({
          service: 'dev.souschef.app.devicekey',
          username: 'device_key',
          password: 'existing-key-from-keychain',
          storage: 'keychain' as STORAGE_TYPE,
        });

      const key = await DeviceKeyManager.getDeviceEncryptionKey();
      expect(key).toBe('existing-key-from-keychain');
      // A transient read error must NOT trigger key generation — that would
      // overwrite the real key and make the existing MMKV file undecryptable.
      expect(mockedSetGenericPassword).not.toHaveBeenCalled();
    });

    it('throws on Android too when the keychain keeps failing', async () => {
      Object.defineProperty(Platform, 'OS', {
        value: 'android',
        configurable: true,
      });
      mockedGetGenericPassword.mockRejectedValue(new Error('keychain dead'));
      mockedSetGenericPassword.mockRejectedValue(
        new Error('keychain write dead'),
      );

      await expect(DeviceKeyManager.getDeviceEncryptionKey()).rejects.toThrow(
        'keychain dead',
      );
    });
  });
});
