import { Platform } from 'react-native';
import {
  SECURITY_LEVEL,
  ACCESSIBLE,
  getSupportedBiometryType,
  setGenericPassword,
  getGenericPassword,
  resetGenericPassword,
} from 'react-native-keychain';
import { logger } from '#/utils/environment';
const DEVICE_KEY_SERVICE = 'dev.souschef.app.devicekey';
const DEVICE_KEY_USERNAME = 'device_key';

/**
 * Key format marker. Keys written before this existed are bare strings; see
 * {@link parseStoredKey} for why they must keep their original cipher.
 */
const KEY_V2_PREFIX = 'v2:';

/**
 * 32 characters, because MMKV reads the key as raw bytes and takes at most 32
 * of them under AES-256 (16 under AES-128). Anything past that is discarded.
 */
const KEY_LENGTH = 32;

/**
 * 64 characters, so each one carries exactly 6 bits and a random byte maps to
 * it with `& 63` — uniform, no modulo bias. 32 chars × 6 bits = 192 bits.
 *
 * The previous key was a uuid v4 with its hyphens stripped: 32 hex characters.
 * Hex carries 4 bits per character, and MMKV's default AES-128 keeps only the
 * first 16 bytes — so that key delivered 16 × 4 = **64 bits** of entropy, not
 * the 128 its length suggested.
 */
const KEY_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** MMKV's cipher choice, carried alongside the key it belongs to. */
export type StorageEncryptionType = 'AES-128' | 'AES-256';

export interface DeviceEncryptionKey {
  key: string;
  encryptionType: StorageEncryptionType;
}

/**
 * Decide the cipher from the stored key's format.
 *
 * A legacy (unprefixed) key encrypted its MMKV file under AES-128, which is
 * what react-native-mmkv defaults to when `encryptionType` is omitted. Opening
 * that file with AES-256 would fail to decrypt, and MMKV DISCARDS a file it
 * cannot decrypt — so an existing install keeps its original cipher. Only a
 * freshly generated key gets AES-256.
 */
function parseStoredKey(stored: string): DeviceEncryptionKey {
  return stored.startsWith(KEY_V2_PREFIX)
    ? { key: stored.slice(KEY_V2_PREFIX.length), encryptionType: 'AES-256' }
    : { key: stored, encryptionType: 'AES-128' };
}

/** 32 characters of crypto-random key material — 192 bits of entropy. */
function generateKeyMaterial(): string {
  const bytes = new Uint8Array(KEY_LENGTH);
  crypto.getRandomValues(bytes);
  let key = '';
  for (const byte of bytes) {
    key += KEY_ALPHABET[byte & 63];
  }
  return key;
}

// Keychain access can fail transiently (e.g. right after device restore or
// during early-boot races). Retry before giving up so a hiccup doesn't take
// down encrypted storage.
const KEY_FETCH_ATTEMPTS = 3;
const RETRY_DELAY_BASE_MS = 200;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface DeviceKeyOptions {
  forceRegenerate?: boolean;
}

/**
 * Generates a secure, device-specific encryption key for MMKV storage.
 *
 * Storage tier: react-native-keychain (iOS Keychain / Android Keystore).
 * The key is generated via uuid v4 (generateId()), backed by
 * crypto.getRandomValues() (polyfilled by react-native-get-random-values).
 */
export class DeviceKeyManager {
  private static cachedKey: DeviceEncryptionKey | null = null;

  /**
   * Get or generate a device-specific encryption key.
   *
   * Fail-closed: retries keychain access with backoff, then THROWS if the
   * keychain is genuinely unavailable. Callers must not fall back to a
   * predictable key or unencrypted storage — a keychain outage should block
   * encrypted-storage init, not silently downgrade it.
   */
  static async getDeviceEncryptionKey(
    options: DeviceKeyOptions = {},
  ): Promise<DeviceEncryptionKey> {
    const { forceRegenerate = false } = options;

    if (DeviceKeyManager.cachedKey && !forceRegenerate) {
      return DeviceKeyManager.cachedKey;
    }

    let lastError: unknown;
    for (let attempt = 1; attempt <= KEY_FETCH_ATTEMPTS; attempt++) {
      try {
        if (!forceRegenerate) {
          // A read ERROR throws (and is retried) rather than being treated as
          // "no key" — generating a fresh key over an existing one would make
          // the current MMKV file undecryptable.
          const existingKey = await readKeyFromKeychain();
          if (existingKey) {
            const parsed = parseStoredKey(existingKey);
            DeviceKeyManager.cachedKey = parsed;
            return parsed;
          }
        }

        const newKey = await DeviceKeyManager.generateNewKey();
        DeviceKeyManager.cachedKey = newKey;
        return newKey;
      } catch (error) {
        lastError = error;
        logger.warn(
          `Device key fetch failed (attempt ${attempt}/${KEY_FETCH_ATTEMPTS}):`,
          error,
        );
        if (attempt < KEY_FETCH_ATTEMPTS) {
          await delay(RETRY_DELAY_BASE_MS * attempt);
        }
      }
    }

    logger.error('Device key unavailable after retries, failing closed');
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to obtain device encryption key');
  }

  /**
   * Generate a new device-specific encryption key: 32 crypto-random characters
   * (192 bits), stored with the `v2:` marker so it is opened under AES-256.
   *
   * `crypto.getRandomValues` is polyfilled by react-native-get-random-values,
   * imported at the top of index.js.
   */
  private static async generateNewKey(): Promise<DeviceEncryptionKey> {
    const key = generateKeyMaterial();

    const stored = await writeKeyToKeychain(`${KEY_V2_PREFIX}${key}`);
    if (!stored) {
      // Surface the failure so the retry loop in getDeviceEncryptionKey can
      // try again (and ultimately fail closed).
      throw new Error('Failed to persist device key to keychain');
    }

    return { key, encryptionType: 'AES-256' };
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
  static async regenerateKey(): Promise<DeviceEncryptionKey> {
    try {
      await resetGenericPassword({ service: DEVICE_KEY_SERVICE });
    } catch (error) {
      logger.warn('Error clearing old key from keychain:', error);
    }
    DeviceKeyManager.clearCachedKey();
    return DeviceKeyManager.getDeviceEncryptionKey({ forceRegenerate: true });
  }
}

/**
 * Read the device key from the keychain. Returns null only on confirmed
 * absence; a read ERROR propagates so the caller retries instead of
 * generating a fresh key over an existing (temporarily unreadable) one.
 */
async function readKeyFromKeychain(): Promise<string | null> {
  const result = await getGenericPassword({ service: DEVICE_KEY_SERVICE });
  if (result && result.password) {
    return result.password;
  }
  return null;
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
    logger.warn(
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
    logger.error('Failed to write device key to keychain:', error);
    return false;
  }
}
