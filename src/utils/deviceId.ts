import { storage } from '#/storage/mmkv';
import { generateId } from './generateId';

const DEVICE_ID_KEY = 'device_id';
let cachedDeviceId: string | null = null;

/**
 * Get or create a unique device identifier.
 * Persisted to MMKV to survive app restarts.
 *
 * Used for subscription self-echo prevention: when this device makes a mutation,
 * the server includes our deviceId in the subscription payload, allowing us
 * to skip processing our own updates (which were already handled by the mutation).
 */
export function getDeviceId(): string {
  if (cachedDeviceId) return cachedDeviceId;

  let deviceId = storage.getString(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device_${generateId()}`;
    storage.set(DEVICE_ID_KEY, deviceId);
  }

  cachedDeviceId = deviceId;
  return deviceId;
}

/**
 * Synchronous getter for cached device ID.
 * Returns null if getDeviceId() hasn't been called yet.
 *
 * Use this in hot paths (like subscription handlers) where we want to
 * avoid redundant storage reads.
 */
export function getDeviceIdSync(): string | null {
  return cachedDeviceId;
}

/**
 * Initialize the device ID cache.
 * Call this early in app startup (e.g., in App.tsx).
 * Since MMKV is synchronous, this just ensures the cache is populated.
 */
export function initializeDeviceId(): string {
  return getDeviceId();
}
