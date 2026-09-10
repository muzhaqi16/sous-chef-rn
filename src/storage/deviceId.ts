import { storage, isStorageReady, isRecoveryStorage } from '#/storage/mmkv';
import { loadDeviceId, saveDeviceId } from '#/storage/keychain';
import { generateId } from '#/utils/generateId';

const DEVICE_ID_KEY = 'device_id';
const LEGACY_FINGERPRINT_KEY = 'device_fingerprint';

let cachedDeviceId: string | null = null;
let hydration: Promise<string | null> | null = null;

// The recovery instance is not this install's store: it opens unencrypted when
// the device key is unavailable and `purgeRecoveryStorage` erases it on the next
// healthy launch, so a value mirrored there is gone by the launch that reads it.
const mirrorIsUsable = (): boolean => isStorageReady() && !isRecoveryStorage();

/** Mirror where a mirror will survive, then memoize for the synchronous readers. */
function commit(deviceId: string): string {
  if (mirrorIsUsable()) storage.set(DEVICE_ID_KEY, deviceId);
  cachedDeviceId = deviceId;
  return deviceId;
}

/**
 * This install's one device identity: the `x-device-id` header, the socket's
 * connection params, device registration and the device credential all present
 * it. Synchronous and read-only — it never mints, so a caller on a cold cache
 * gets null rather than an identity no later launch would agree with.
 */
export function getDeviceId(): string | null {
  if (cachedDeviceId) return cachedDeviceId;
  if (!mirrorIsUsable()) return null;

  const mirrored = storage.getString(DEVICE_ID_KEY);
  if (!mirrored) return null;

  cachedDeviceId = mirrored;
  return mirrored;
}

async function hydrate(): Promise<string | null> {
  const mirrored = getDeviceId();
  if (mirrored) {
    // An install that predates the keychain copy has the identifier in MMKV
    // only. Write through, so it and the credential bound to it now share a
    // lifetime; the value does not change.
    await saveDeviceId(mirrored);
    return mirrored;
  }

  const durable = await loadDeviceId();
  if (durable.status === 'ok') return commit(durable.deviceId);
  // A read that failed says nothing about what the keychain holds. Minting here
  // would write over a surviving identifier and orphan the credential bound to
  // it, so this launch reports the identifier absent instead.
  if (durable.status === 'error') return null;

  const minted = `device_${generateId()}`;
  const persisted = await saveDeviceId(minted);
  // Nothing would hold it: presenting it would register a device this launch
  // and a different one on the next.
  if (!persisted && !mirrorIsUsable()) return null;

  return commit(minted);
}

/**
 * Resolve the identifier, minting one on a device that has none. Single-flight:
 * concurrent callers share one hydration rather than racing to mint. For the
 * callers that cannot proceed without an identity — registration, and issuing,
 * exchanging or revoking a device credential.
 */
export function ensureDeviceId(): Promise<string | null> {
  if (cachedDeviceId) return Promise.resolve(cachedDeviceId);

  hydration ??= hydrate().finally(() => {
    hydration = null;
  });
  return hydration;
}

/**
 * An install carrying this key has a server device row filed under it, separate
 * from the row {@link getDeviceId}'s value names. The row is retired once and
 * the key removed; a fresh install has neither.
 */
export function readLegacyDeviceFingerprint(): string | null {
  if (!mirrorIsUsable()) return null;
  return storage.getString(LEGACY_FINGERPRINT_KEY) ?? null;
}

/** Called only once the server confirms the row is gone. */
export function clearLegacyDeviceFingerprint(): void {
  if (mirrorIsUsable()) storage.remove(LEGACY_FINGERPRINT_KEY);
}
