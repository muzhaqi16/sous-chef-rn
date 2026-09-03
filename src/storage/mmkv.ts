import { createMMKV, type MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import { logger } from '#/utils/environment';
import {
  DeviceKeyManager,
  type DeviceEncryptionKey,
} from '#/utils/security/deviceKey';

export const STORAGE_KEY = 'sous-chef-storage';

// Separate instance id used when the device encryption key is unavailable.
// The primary encrypted file must never be opened without its key (MMKV
// discards the file contents on a decrypt/CRC mismatch), so a keychain outage
// quarantines the session here and leaves the encrypted file intact for the
// next launch.
export const RECOVERY_STORAGE_KEY = `${STORAGE_KEY}-recovery`;

// DeviceKeyManager already retries keychain reads internally; run that whole
// cycle a second time after a pause before quarantining the session.
const KEY_FETCH_CYCLES = 2;
const KEY_FETCH_CYCLE_DELAY_MS = 1000;

// In test environments, createMMKV is synchronous (mocked) and there is no
// secure keychain to await. Eagerly create the instance so sync `storage.X`
// access works at module-load time without any async dance in test setup.
const IS_TEST = process.env.NODE_ENV === 'test';

let secureStorageInstance: MMKV | null = IS_TEST
  ? createMMKV({ id: STORAGE_KEY })
  : null;
let initPromise: Promise<MMKV> | null = null;

// True once the device encryption key proved unavailable and the session fell
// back to the unencrypted RECOVERY_STORAGE_KEY instance. Read by the store's
// partialize so plaintext token persistence is skipped in that degraded state.
let usingRecoveryInstance = false;

// True when the encrypted instance opened with nothing in it.
let openedEmptyStore = false;

/**
 * Run DeviceKeyManager's full fetch (which retries keychain access
 * internally) up to KEY_FETCH_CYCLES times before giving up, so a brief
 * early-boot keychain outage doesn't quarantine the session.
 */
const getEncryptionKeyWithRetry = async (): Promise<DeviceEncryptionKey> => {
  let lastError: unknown;
  for (let cycle = 1; cycle <= KEY_FETCH_CYCLES; cycle++) {
    try {
      return await DeviceKeyManager.getDeviceEncryptionKey();
    } catch (error) {
      lastError = error;
      if (cycle < KEY_FETCH_CYCLES) {
        await new Promise(resolve =>
          setTimeout(resolve, KEY_FETCH_CYCLE_DELAY_MS),
        );
      }
    }
  }
  throw lastError;
};

/**
 * Erase whatever a quarantined session left in the unencrypted recovery file,
 * once the encrypted instance opens again. Deferred off the startup path: it is
 * cleanup, and every launch after the outage would otherwise pay for it.
 */
export const purgeRecoveryStorage = (): void => {
  try {
    const recovery = createMMKV({ id: RECOVERY_STORAGE_KEY });
    if (recovery.getAllKeys().length === 0) return;
    recovery.clearAll();
    logger.info('Cleared data left behind in recovery storage.');
  } catch (error) {
    logger.warn('Could not clear recovery storage:', error);
  }
};

const scheduleRecoveryPurge = (): void => {
  const idle = (
    globalThis as { requestIdleCallback?: (cb: () => void) => void }
  ).requestIdleCallback;
  if (typeof idle === 'function') {
    idle(purgeRecoveryStorage);
    return;
  }
  setTimeout(purgeRecoveryStorage, 0);
};

/**
 * Initialize the encrypted MMKV instance; idempotent. Must run from index.js
 * before App renders. Fail-closed: the primary file is only ever opened WITH
 * its key, so a key outage runs the session on a separate unencrypted recovery
 * instance rather than risking MMKV discarding the encrypted file.
 */
export const initializeSecureStorage = async (): Promise<MMKV> => {
  if (secureStorageInstance) return secureStorageInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let instance: MMKV;
    try {
      // The cipher travels with the key: a key minted before the app chose one
      // encrypted its file under MMKV's AES-128 default, and MMKV DISCARDS a
      // file it cannot decrypt — so opening a legacy file under AES-256 would
      // wipe it. Fresh installs get AES-256. See DeviceKeyManager.
      const { key, encryptionType } = await getEncryptionKeyWithRetry();
      instance = createMMKV({
        id: STORAGE_KEY,
        encryptionKey: key,
        encryptionType,
      });
    } catch (error) {
      logger.error(
        'Device key unavailable; quarantining session in recovery storage:',
        error,
      );
      import('#services/telemetry')
        .then(({ Telemetry }) =>
          Telemetry.increment('storage_recovery_instance_used'),
        )
        .catch(() => {});
      instance = createMMKV({ id: RECOVERY_STORAGE_KEY });
      usingRecoveryInstance = true;
    }

    // An empty encrypted store means no local state stands behind whatever the
    // keychain still holds — a reinstall, or cleared app data. Recorded here
    // and read during hydration, which is where the keychain is reachable
    // without closing an import cycle through i18n and the store.
    if (!usingRecoveryInstance) {
      openedEmptyStore = instance.getAllKeys().length === 0;
    }

    secureStorageInstance = instance;
    if (!usingRecoveryInstance) {
      scheduleRecoveryPurge();
    }
    return instance;
  })();

  return initPromise;
};

/**
 * Async getter — preferred for new code. Triggers init if not yet started.
 */
export const getStorage = async (): Promise<MMKV> => initializeSecureStorage();

/**
 * Synchronous storage proxy. After `initializeSecureStorage()` resolves, all
 * reads/writes route to the encrypted MMKV file. Accessed before then in
 * production code, this throws — `index.js` kicks off init before any React
 * code runs, and `zustandStorage` awaits it during Zustand hydration.
 */
export const storage: MMKV = new Proxy({} as MMKV, {
  get(_target, prop) {
    if (!secureStorageInstance) {
      throw new Error(
        `Storage accessed before initialization (prop: ${String(prop)}). ` +
          `Ensure initializeSecureStorage() is called in index.js before any sync storage access.`,
      );
    }
    const value = Reflect.get(secureStorageInstance, prop);
    if (typeof value !== 'function') return value;
    // Preserve jest.fn() identity so tests can assert via toHaveBeenCalledWith.
    if ((value as { mock?: unknown }).mock != null) return value;
    return (value as (...args: unknown[]) => unknown).bind(
      secureStorageInstance,
    );
  },
  set(_target, prop, value) {
    if (!secureStorageInstance) {
      throw new Error(
        `Storage written before initialization (prop: ${String(prop)}).`,
      );
    }
    Reflect.set(secureStorageInstance, prop, value);
    return true;
  },
});

export function isStorageReady(): boolean {
  return secureStorageInstance !== null;
}

/**
 * Whether the active MMKV instance is the unencrypted recovery fallback (opened
 * because the device encryption key was unavailable). When true, callers must
 * not write secrets to persisted storage — the file is plaintext at rest.
 */
export function isRecoveryStorage(): boolean {
  return usingRecoveryInstance;
}

/**
 * Whether the encrypted store opened empty — a reinstall, or cleared app data.
 * A keychain item outlives the app on iOS, so session tokens can still be there
 * with no local state behind them; hydration reads this and refuses to resume
 * a session the device has no other trace of.
 */
export function openedWithEmptyStore(): boolean {
  return openedEmptyStore;
}

export const zustandStorage: StateStorage = {
  setItem: async (name, value) => {
    const s = await initializeSecureStorage();
    return s.set(name, value);
  },
  getItem: async name => {
    const s = await initializeSecureStorage();
    const value = s.getString(name);
    return value ?? null;
  },
  removeItem: async name => {
    const s = await initializeSecureStorage();
    return s.remove(name);
  },
};
