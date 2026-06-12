import { createMMKV, type MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';
import { logger } from '#/utils/environment';
import { DeviceKeyManager } from '#/utils/security/deviceKey';

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

/**
 * Run DeviceKeyManager's full fetch (which retries keychain access
 * internally) up to KEY_FETCH_CYCLES times before giving up, so a brief
 * early-boot keychain outage doesn't quarantine the session.
 */
const getEncryptionKeyWithRetry = async (): Promise<string> => {
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
 * Initialize the encrypted MMKV instance. Idempotent — subsequent calls
 * return the same instance.
 *
 * Must be called from index.js before App renders. Storage access from React
 * code is gated by `useIsHydrated()` (Zustand persist awaits this internally
 * via `zustandStorage`), so by the time any component reads `storage.X` the
 * encrypted instance is ready.
 *
 * Fail-closed contract (mirrors DeviceKeyManager): the primary encrypted
 * file is only ever opened with its key. If the key is unavailable after
 * retries, this session runs on a separate unencrypted RECOVERY instance —
 * the app stays usable with fresh defaults, the encrypted data survives for
 * the next launch, and session tokens are unaffected (they live in the
 * keychain, see src/storage/keychain.ts).
 */
export const initializeSecureStorage = async (): Promise<MMKV> => {
  if (secureStorageInstance) return secureStorageInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    let instance: MMKV;
    try {
      const encryptionKey = await getEncryptionKeyWithRetry();
      instance = createMMKV({ id: STORAGE_KEY, encryptionKey });
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
    }

    secureStorageInstance = instance;
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
