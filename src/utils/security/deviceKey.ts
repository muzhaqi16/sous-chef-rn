import { Platform } from 'react-native';
import {
  ACCESS_CONTROL,
  SECURITY_LEVEL,
  ACCESSIBLE,
  getSupportedBiometryType,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';
import { storage } from '#/storage/mmkv';

const DEVICE_KEY_SERVICE = 'dev.souschef.app.devicekey';
const DEVICE_KEY_USERNAME = 'device_key';
// Legacy MMKV key — only read for migration to Keychain on first launch after upgrade.
const LEGACY_MMKV_KEY = 'device_encryption_key';

interface DeviceKeyOptions {
  forceRegenerate?: boolean;
}

/**
 * Generates a secure, device-specific encryption key for MMKV storage.
 *
 * Storage tier: react-native-keychain (iOS Keychain / Android Keystore).
 * The key is generated with crypto-secure randomness via crypto.getRandomValues
 * (polyfilled by react-native-get-random-values, imported in index.js).
 *
 * Migration: any legacy key stored under `device_encryption_key` in unencrypted
 * MMKV (from prior versions) is read once, copied to the Keychain, and removed.
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
        const existingKey = await DeviceKeyManager.loadExistingKey();
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
   * Load existing encryption key from the keychain. Falls back to a one-time
   * migration read of any legacy MMKV-stored key, then immediately copies it
   * to the keychain and clears the unencrypted MMKV entry.
   */
  private static async loadExistingKey(): Promise<string | null> {
    // 1. Try keychain first (the source of truth from now on).
    const fromKeychain = await readKeyFromKeychain();
    if (fromKeychain) {
      // Best-effort cleanup of any leftover legacy entry.
      try {
        if (storage.getString(LEGACY_MMKV_KEY)) {
          storage.remove(LEGACY_MMKV_KEY);
        }
      } catch {
        // ignore
      }
      return fromKeychain;
    }

    // 2. One-time migration: legacy installs stored the key in MMKV.
    let legacyKey: string | undefined;
    try {
      legacyKey = storage.getString(LEGACY_MMKV_KEY);
    } catch {
      legacyKey = undefined;
    }

    if (legacyKey) {
      const migrated = await writeKeyToKeychain(legacyKey);
      if (migrated) {
        try {
          storage.remove(LEGACY_MMKV_KEY);
        } catch {
          // ignore
        }
      }
      return legacyKey;
    }

    return null;
  }

  /**
   * Generate a new device-specific encryption key using crypto-secure RNG.
   * Uses crypto.getRandomValues (polyfilled by react-native-get-random-values
   * in index.js) for cryptographic-quality entropy.
   */
  private static async generateNewKey(): Promise<string> {
    const key = generateSecureRandomHex(32); // 32 bytes -> 64 hex chars

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
      // Deterministic 32-char hex from a stable seed using a simple FNV-1a hash.
      // This is intentionally NOT cryptographically secure — it only protects
      // against the catastrophic case where the keychain is unavailable.
      return fnvHashHex(seed).padEnd(32, '0').substring(0, 32);
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
    try {
      storage.remove(LEGACY_MMKV_KEY);
    } catch {
      // ignore
    }
    DeviceKeyManager.clearCachedKey();
    return DeviceKeyManager.getDeviceEncryptionKey({ forceRegenerate: true });
  }
}

/**
 * Read the device key from the keychain. Returns null on failure or absence.
 * Tries hardware-backed (biometric/passcode) storage first, but does NOT
 * trigger a biometric prompt — we use device-passcode-only access control to
 * avoid blocking app startup.
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
 * Write the device key to the keychain. Tries device-passcode-protected
 * storage first (no biometric prompt). Returns true on success.
 */
async function writeKeyToKeychain(key: string): Promise<boolean> {
  // Use WHEN_UNLOCKED_THIS_DEVICE_ONLY without biometric access control —
  // we need this readable on every cold start without prompting the user.
  const passcodeOptions = {
    service: DEVICE_KEY_SERVICE,
    accessible: ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    accessControl: ACCESS_CONTROL.DEVICE_PASSCODE,
    securityLevel:
      Platform.OS === 'android' ? SECURITY_LEVEL.SECURE_HARDWARE : undefined,
  };

  try {
    const result = await setGenericPassword(
      DEVICE_KEY_USERNAME,
      key,
      passcodeOptions,
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

/**
 * Generate a cryptographically secure random hex string of the given byte length.
 * Uses crypto.getRandomValues (polyfilled by react-native-get-random-values
 * in index.js).
 */
function generateSecureRandomHex(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  // crypto is provided by react-native-get-random-values (imported in index.js).
  // eslint-disable-next-line no-undef
  crypto.getRandomValues(bytes);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * FNV-1a hash for the deterministic fallback key. NOT cryptographically secure.
 */
function fnvHashHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  // Combine with a second pass over the reversed string for a longer output.
  let hash2 = 0x811c9dc5;
  for (let i = input.length - 1; i >= 0; i--) {
    hash2 ^= input.charCodeAt(i);
    hash2 = (hash2 * 0x01000193) >>> 0;
  }
  return (
    hash.toString(16).padStart(8, '0') + hash2.toString(16).padStart(8, '0')
  );
}
