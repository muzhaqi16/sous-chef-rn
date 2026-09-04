import { storage, isStorageReady } from '#/storage/mmkv';
import { generateId } from '#/utils/generateId';

const DEVICE_ID_KEY = 'device_id';
let cachedDeviceId: string | null = null;

/**
 * A per-device id persisted to MMKV, used for subscription self-echo detection.
 * Before storage is ready this returns a TRANSIENT id; `initializeDeviceId()`
 * reconciles with storage once hydration completes.
 */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  if (!isStorageReady()) {
    return `device_${generateId()}`;
  }

  let deviceId = storage.getString(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${generateId()}`;
    storage.set(DEVICE_ID_KEY, deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}

/**
 * For hot paths that must not touch storage; null until `getDeviceId()` has run.
 */
export function getDeviceIdSync(): string | null {
  return cachedDeviceId;
}

/** Call after hydration; drops any transient id in favour of the stored one. */
export function initializeDeviceId(): string {
  cachedDeviceId = null;
  return getDeviceId();
}
