/**
 * Feature-owned stores a session end must still clear (`SESSION_SCOPED_STATE`
 * only reaches the ROOT store). Metro's `inlineRequires` means an unused module
 * never registers — fine for in-memory state, not for PERSISTED state, whose
 * keys are declared as DATA below and deleted without loading their module.
 */
import { storage } from '#/storage/mmkv';
import { logger } from '#/utils/environment';

type StoreReset = () => void;

const stores = new Map<string, StoreReset>();

/**
 * The `name` each feature store passes to zustand's `persist`. A persisted store
 * missing here survives sign-out on a shared device.
 */
export const SESSION_SCOPED_PERSISTED_KEYS: string[] = [
  // src/features/barcode/store/barcodeScannerStore.ts — scan history carries
  // item names, brands and UPCs.
  'sous-chef-barcode',
  // src/features/recipes/store/useRecipeCacheStore.ts — search terms and results.
  'recipe-search-cache',
  // src/features/recipes/store/useRecipeSuggestionsStore.ts — personalized
  // suggestions derived from the account's pantry.
  'recipe-suggestions-cache',
];

/**
 * Register a feature store's reset. Last write wins, so a hot reload replaces
 * rather than duplicates.
 */
export const registerSessionScopedStore = (
  name: string,
  reset: StoreReset,
): void => {
  stores.set(name, reset);
};

/**
 * Clear every registered feature store.
 *
 * One failure must not skip the rest — a store left populated is the previous
 * person's data on a shared device, which is the whole reason this exists.
 */
export const resetSessionScopedStores = (): void => {
  for (const [name, reset] of stores) {
    try {
      reset();
    } catch (error) {
      logger.warn(`[sessionScopedStores] "${name}" failed to reset`, error);
    }
  }

  // Independent of the loop above: a store whose module was never evaluated has
  // no registration, but its persisted key is still on disk.
  for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
    try {
      storage.remove(key);
    } catch (error) {
      logger.warn(`[sessionScopedStores] "${key}" failed to clear`, error);
    }
  }
};

/** Test seam. */
export const clearSessionScopedStores = (): void => {
  stores.clear();
};

/** The names currently registered, for tests that assert coverage. */
export const registeredSessionScopedStores = (): string[] => [...stores.keys()];
