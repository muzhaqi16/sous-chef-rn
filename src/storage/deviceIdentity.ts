/**
 * The device's own persistent facts, which are NOT session state: they must
 * survive a sign-out (the API keys `Device` rows on the fingerprint) and are
 * read before the store hydrates. The Zustand slices cannot hold either, so
 * the storage layer owns the keys.
 */
import { storage, isStorageReady } from '#/storage/mmkv';

const DEVICE_FINGERPRINT_KEY = 'device_fingerprint';

/** The stored fingerprint, or null when there is none yet. */
export const readDeviceFingerprint = (): string | null =>
  isStorageReady() ? storage.getString(DEVICE_FINGERPRINT_KEY) ?? null : null;

/** Persists the fingerprint. A no-op before storage is ready. */
export const writeDeviceFingerprint = (fingerprint: string): void => {
  if (isStorageReady()) {
    storage.set(DEVICE_FINGERPRINT_KEY, fingerprint);
  }
};
