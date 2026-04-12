import { Platform } from 'react-native';
import {
  SECURITY_LEVEL,
  ACCESSIBLE,
  getSupportedBiometryType,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';
import { generateId } from '../generateId';
const DEVICE_KEY_SERVICE = 'dev.souschef.app.devicekey';
const DEVICE_KEY_USERNAME = 'device_key';

interface DeviceKeyOptions {
  forceRegenerate?: boolean;
}

/**
 * Generates a secure, device-specific encryption key for MMKV storage.
 *
 * Storage tier: react-native-keychain (iOS Keychain / Android Keystore).
 * The key is generated via uuid v4 (generateId()),
 * backed by react-native-get-random-values.
 */
export class DeviceKeyManager {
  private static cachedKey: string | null = null;

  /**
   * Get or generate a device-specific encryption key
   */
  static async getDeviceEncryptionKey(
    options: DeviceKeyOptions = {},
  ): Promise<string> {
    const { forceRegenerate = false } = options;

    if (DeviceKeyManager.cachedKey && !forceRegenerate) {
      return DeviceKeyManager.cachedKey;
    }

    try {
      if (!forceRegenerate) {
        const existingKey = await readKeyFromKeychain();
        if (existingKey) {
          DeviceKeyManager.cachedKey = existingKey;
          return existingKey;
        }
      }

      const newKey = await DeviceKeyManager.generateNewKey();
      DeviceKeyManager.cachedKey = newKey;
      return newKey;
    } catch (error) {
      console.warn(
        'Failed to get device encryption key, using fallback:',
        error,
      );
      return DeviceKeyManager.getFallbackKey();
    }
  }

  /**
   * Generate a new device-specific encryption key using uuid v4
   * (via generateId(), backed by react-native-get-random-values).
   */
  private static async generateNewKey(): Promise<string> {
    const key = generateId().replaceAll('-', '');

    const stored = await writeKeyToKeychain(key);
    if (!stored) {
      // If keychain write fails entirely, surface the error so the
      // caller falls back to getFallbackKey().
      throw new Error('Failed to persist device key to keychain');
    }

    return key;
  }

  /**
   * Get fallback encryption key when secure storage fails.
   * Last-resort: a deterministic platform-derived key. Better than no
   * encryption, but a real keychain-stored key should always be preferred.
   */
  private static getFallbackKey(): string {
    try {
      const seed = `${Platform.OS}-${Platform.Version}-sous-chef-fallback`;
      return seed.padEnd(32, '0').substring(0, 32);
    } catch {
      console.warn('Using static fallback key - security reduced');
      return ('sous-chef-emergency-fallback-key-' + Platform.OS)
        .padEnd(32, '0')
        .substring(0, 32);
    }
  }

  /**
   * Clear cached key (useful for testing or forced regeneration)
   */
  static clearCachedKey(): void {
    DeviceKeyManager.cachedKey = null;
  }

  /**
   * Check if biometric authentication is available for key storage
   */
  static async isBiometricAvailable(): Promise<boolean> {
    try {
      const biometryType = await getSupportedBiometryType();
      return biometryType !== null;
    } catch {
      return false;
    }
  }

  /**
   * Regenerate encryption key (use with caution - will invalidate existing encrypted data)
   */
  static async regenerateKey(): Promise<string> {
    try {
      await resetGenericPassword({ service: DEVICE_KEY_SERVICE });
    } catch (error) {
      console.warn('Error clearing old key from keychain:', error);
    }
    DeviceKeyManager.clearCachedKey();
    return DeviceKeyManager.getDeviceEncryptionKey({ forceRegenerate: true });
  }
}

/**
 * Read the device key from the keychain. Returns null on failure or absence.
 */
async function readKeyFromKeychain(): Promise<string | null> {
  try {
    const result = await getGenericPassword({ service: DEVICE_KEY_SERVICE });
    if (result && result.password) {
      return result.password;
    }
    return null;
  } catch (error) {
    console.warn('Failed to read device key from keychain:', error);
    return null;
  }
}

/**
 * Write the device key to the keychain with hardware-backed storage.
 * No access control is set — the key must be readable on every cold start
 * without prompting the user. WHEN_UNLOCKED_THIS_DEVICE_ONLY already ensures
 * the key is only accessible while the device is unlocked.
 */
async function writeKeyToKeychain(key: string): Promise<boolean> {
  const hardwareOptions = {
    service: DEVICE_KEY_SERVICE,
    accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    securityLevel:
      Platform.OS === 'android' ? SECURITY_LEVEL.SECURE_HARDWARE : undefined,
  };

  try {
    const result = await setGenericPassword(
      DEVICE_KEY_USERNAME,
      key,
      hardwareOptions,
    );
    if (result) return true;
  } catch (error) {
    console.warn(
      'Hardware-backed keychain write failed, trying software:',
      error,
    );
  }

  // Software fallback for older Android devices without hardware keystore.
  try {
    const softwareOptions = {
      service: DEVICE_KEY_SERVICE,
      accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      securityLevel:
        Platform.OS === 'android' ? SECURITY_LEVEL.SECURE_SOFTWARE : undefined,
    };
    const result = await setGenericPassword(
      DEVICE_KEY_USERNAME,
      key,
      softwareOptions,
    );
    return !!result;
  } catch (error) {
    console.error('Failed to write device key to keychain:', error);
    return false;
  }
}
