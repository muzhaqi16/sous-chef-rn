import { storage, isStorageReady } from '#/storage/mmkv';
import { generateId } from '#/utils/generateId';

const DEVICE_ID_KEY = 'device_id';
let cachedDeviceId: string | null = null;

/**
 * This install's one device identity: the `x-device-id` header, the socket's
 * connection params, device registration and the device credential all present
 * it. Null before storage opens — a caller sends nothing rather than a
 * substitute, which would register a new device on every launch.
 */
export function getDeviceId(): string | null {
  if (cachedDeviceId) return cachedDeviceId;
  if (!isStorageReady()) return null;

  let deviceId = storage.getString(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${generateId()}`;
    storage.set(DEVICE_ID_KEY, deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}

/** Call after hydration, so the first reader is not the one that pays for it. */
export function initializeDeviceId(): string | null {
  cachedDeviceId = null;
  return getDeviceId();
}
