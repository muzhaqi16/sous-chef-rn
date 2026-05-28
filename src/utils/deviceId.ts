import { storage, isStorageReady } from '#/storage/mmkv';
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
 *
 * If storage isn't initialized yet (early startup race), returns a transient ID.
 * `initializeDeviceId()` reconciles with storage once hydration completes.
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
 * Initialize the device ID cache from storage.
 * Call this early in app startup after hydration (e.g., in useStartupInit).
 * Clears any transient ID so the persisted value is used going forward.
 */
export function initializeDeviceId(): string {
  cachedDeviceId = null;
  return getDeviceId();
}
