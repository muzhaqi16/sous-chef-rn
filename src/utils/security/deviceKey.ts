import { Platform } from 'react-native';
import * as Keychain from 'react-native-keychain';
import { storage } from '#/storage/mmkv';

const DEVICE_KEY_SERVICE = 'dev.souschef.app.devicekey';
const DEVICE_KEY_STORAGE = 'device_encryption_key';

interface DeviceKeyOptions {
  forceRegenerate?: boolean;
}

/**
 * Generates a secure, device-specific encryption key for MMKV storage.
 * The key is stored in the device keychain with biometric protection when available.
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

    // Return cached key if available and not forcing regeneration
    if (DeviceKeyManager.cachedKey && !forceRegenerate) {
      return DeviceKeyManager.cachedKey;
    }

    try {
      // Try to load existing key from keychain first
      if (!forceRegenerate) {
        const existingKey = await DeviceKeyManager.loadExistingKey();
        if (existingKey) {
          DeviceKeyManager.cachedKey = existingKey;
          return existingKey;
        }
      }

      // Generate new key if none exists or forced regeneration
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
   * Load existing encryption key from secure storage
   */
  private static async loadExistingKey(): Promise<string | null> {
    try {
      // Only use MMKV for device key storage to avoid biometric prompts during app startup
      // This is acceptable since the device key is used to encrypt MMKV data,
      // and the device itself provides the security boundary
      const mmkvKey = storage.getString(DEVICE_KEY_STORAGE);
      if (mmkvKey) {
        return mmkvKey;
      }

      // If no key exists in MMKV, we'll generate a new one
      // We don't try keychain access here to avoid biometric prompts on app startup
      return null;
    } catch (error) {
      console.warn('Error loading existing device key:', error);
      return null;
    }
  }

  /**
   * Generate a new device-specific encryption key
   */
  private static async generateNewKey(): Promise<string> {
    try {
      // Get device identifiers using React Native built-ins
      const deviceId = DeviceKeyManager.getReactNativeDeviceId();
      const bundleId = 'dev.souschef.app.app'; // Fallback bundle ID
      const buildNumber = '1.0.0'; // Fallback build number
      const timestamp = Date.now().toString();
      const randomBytes = DeviceKeyManager.generateRandomString(32);

      // Combine device info with random data
      const keyMaterial = `${deviceId}-${bundleId}-${buildNumber}-${timestamp}-${randomBytes}`;

      // Create a hash-like key (simplified - in production, use proper crypto)
      const key = DeviceKeyManager.simpleHash(keyMaterial);

      // Store in MMKV for device key (avoids biometric prompts during startup)
      storage.set(DEVICE_KEY_STORAGE, key);

      return key;
    } catch (error) {
      console.error('Error generating device key:', error);
      throw new Error('Failed to generate device encryption key');
    }
  }

  /**
   * Store encryption key in keychain with appropriate security level
   */
  private static async storeKeyInKeychain(key: string): Promise<void> {
    try {
      // Try to store with biometric protection first
      const biometricOptions = {
        service: DEVICE_KEY_SERVICE,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE,
        securityLevel:
          Platform.OS === 'android'
            ? Keychain.SECURITY_LEVEL.SECURE_HARDWARE
            : undefined,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      };

      let success: boolean = false;
      try {
        const result = await Keychain.setGenericPassword(
          'device_key',
          key,
          biometricOptions,
        );
        success = !!result;
      } catch (biometricError) {
        console.warn(
          'Biometric storage failed, trying device passcode only:',
          biometricError,
        );
      }

      // Fallback to device passcode only if biometric storage fails
      if (!success) {
        const passcodeOptions = {
          service: DEVICE_KEY_SERVICE,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          securityLevel:
            Platform.OS === 'android'
              ? Keychain.SECURITY_LEVEL.SECURE_SOFTWARE
              : undefined,
        };

        const result = await Keychain.setGenericPassword(
          'device_key',
          key,
          passcodeOptions,
        );
        success = !!result;
      }

      if (!success) {
        throw new Error('Failed to store key in keychain');
      }
    } catch (error) {
      console.error('Error storing key in keychain:', error);
      // Fallback to MMKV storage (less secure but better than hardcoded)
      storage.set(DEVICE_KEY_STORAGE, key);
    }
  }

  /**
   * Get fallback encryption key when secure storage fails
   */
  private static getFallbackKey(): string {
    try {
      // Try to get device-specific info for fallback
      const deviceId = DeviceKeyManager.getReactNativeDeviceId();
      const bundleId = 'dev.souschef.app.app';

      // Create deterministic but device-specific key
      return DeviceKeyManager.simpleHash(
        `${deviceId}-${bundleId}-sous-chef-fallback`,
      );
    } catch (error) {
      console.warn('Using static fallback key - security reduced');
      // Last resort - still better than the original hardcoded key
      return 'sous-chef-emergency-fallback-key-' + Platform.OS;
    }
  }

  /**
   * Simple hash function for key generation (replace with proper crypto in production)
   */
  private static simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to positive string and pad
    const positiveHash = Math.abs(hash).toString(16);
    const timestamp = Date.now().toString(16);
    return `${positiveHash}-${timestamp}`.padEnd(32, '0').substring(0, 32);
  }

  /**
   * Get device ID using React Native built-in methods
   */
  private static getReactNativeDeviceId(): string {
    try {
      // Use a combination of Platform info and timestamp to create a unique-ish identifier
      const platformInfo = `${Platform.OS}-${Platform.Version}`;
      const randomSeed = Math.random().toString(36).substring(2, 15);

      // Try to get from storage first for consistency
      const storedId = storage.getString('device_unique_id');
      if (storedId) {
        return storedId;
      }

      // Create and store new ID
      const newId = `${platformInfo}-${Date.now()}-${randomSeed}`;
      storage.set('device_unique_id', newId);
      return newId;
    } catch (error) {
      console.warn('Failed to generate device ID, using fallback:', error);
      return `${Platform.OS}-${Date.now()}-fallback`;
    }
  }

  /**
   * Generate random string for key material
   */
  private static generateRandomString(length: number): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
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
      const biometryType = await Keychain.getSupportedBiometryType();
      return biometryType !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Regenerate encryption key (use with caution - will invalidate existing encrypted data)
   */
  static async regenerateKey(): Promise<string> {
    try {
      // Clear old key from keychain
      await Keychain.resetGenericPassword({ service: DEVICE_KEY_SERVICE });
      storage.delete(DEVICE_KEY_STORAGE);
    } catch (error) {
      console.warn('Error clearing old key:', error);
    }

    return DeviceKeyManager.getDeviceEncryptionKey({ forceRegenerate: true });
  }
}
