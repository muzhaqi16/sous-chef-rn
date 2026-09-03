/**
 * Shared test mock for `#/storage/mmkv`.
 *
 * Activated per-suite via a bare `jest.mock('#/storage/mmkv')` (no factory).
 * Provides the COMPLETE module surface so transitive consumers work without
 * per-suite factories — most notably the Zustand store
 * (`src/store/index.ts`), whose persist layer reads `zustandStorage` at
 * module load and whose rehydration callback reads `storage.getBoolean`.
 * Partial factories are what caused the "An error happened during hydration"
 * console noise in suites that pulled the store in transitively.
 *
 * All methods are `jest.fn()`s backed by a single in-memory Map, exposed as
 * `__mockStore` for seeding and assertions:
 *
 *   ```ts
 *   jest.mock('#/storage/mmkv');
 *   const { __mockStore } = jest.requireMock<{
 *     __mockStore: Map<string, boolean | string | number | ArrayBuffer>;
 *   }>('#/storage/mmkv');
 *   beforeEach(() => __mockStore.clear());
 *   ```
 *
 *   ✅ DO — override individual return values per-suite:
 *     ```ts
 *     import { storage } from '#/storage/mmkv';
 *     (storage.getBoolean as jest.Mock).mockReturnValue(false);
 *     ```
 *
 *   ❌ DON'T — provide a per-suite factory like
 *     `jest.mock('#/storage/mmkv', () => ({ storage: {...partial...} }))`.
 *     Partial factories REPLACE this shared mock and reintroduce the
 *     missing-export hydration errors it exists to prevent.
 */

type MockStoreValue = boolean | string | number | ArrayBuffer;

const store = new Map<string, MockStoreValue>();

/** Backing Map — seed values or clear between tests. */
export const __mockStore = store;

export const STORAGE_KEY = 'sous-chef-storage';
export const RECOVERY_STORAGE_KEY = `${STORAGE_KEY}-recovery`;

export const storage = {
  set: jest.fn((key: string, value: MockStoreValue) => {
    store.set(key, value);
  }),
  getString: jest.fn((key: string) => store.get(key) as string | undefined),
  getNumber: jest.fn((key: string) => store.get(key) as number | undefined),
  getBoolean: jest.fn((key: string) => store.get(key) as boolean | undefined),
  remove: jest.fn((key: string) => store.delete(key)),
  delete: jest.fn((key: string) => store.delete(key)),
  contains: jest.fn((key: string) => store.has(key)),
  clearAll: jest.fn(() => store.clear()),
  getAllKeys: jest.fn(() => [...store.keys()]),
};

export const zustandStorage = {
  getItem: jest.fn(
    async (name: string) => (store.get(name) as string | undefined) ?? null,
  ),
  setItem: jest.fn(async (name: string, value: string) => {
    store.set(name, value);
  }),
  removeItem: jest.fn(async (name: string) => {
    store.delete(name);
  }),
};

export const initializeSecureStorage = jest.fn(async () => storage);
export const getStorage = jest.fn(async () => storage);
export const isStorageReady = jest.fn(() => true);

/**
 * Defaults to the encrypted instance, which is the state every suite that does
 * not say otherwise means. Override per-test to exercise the quarantined path:
 * `(isRecoveryStorage as jest.Mock).mockReturnValue(true)`.
 */
export const isRecoveryStorage = jest.fn(() => false);
export const openedWithEmptyStore = jest.fn(() => false);
export const purgeRecoveryStorage = jest.fn();
