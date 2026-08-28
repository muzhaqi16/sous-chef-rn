/**
 * Stores that a feature owns, but that a session end must still clear.
 *
 * `SESSION_SCOPED_STATE` in `resetManager.ts` covers the ROOT store. A feature
 * that keeps its own zustand store is outside it by construction — which is how
 * `recipe-search-cache` and `recipe-suggestions-cache` came to survive logout.
 * A feature store registers its reset here instead, and `resetStore` calls the
 * registry.
 *
 * ## Two mechanisms, because lazy registration only covers one case
 *
 * Metro runs with `inlineRequires`, so a feature module is not evaluated until
 * something uses it — which makes registration-on-import unreliable for a
 * registry that must answer questions about code it has never loaded (see the
 * offline queue's `SYNC_REGISTRY`, consulted on every mutation).
 *
 * For state held only in MEMORY that reasoning is fine: a store can hold data
 * only if something imported it, and importing it runs the registration, so an
 * absent registration is an empty reset rather than a missed one.
 *
 * It is FALSE for anything PERSISTED. Persisted state exists precisely because a
 * previous process ended: user A scans items, the app is killed, user A signs
 * out on the next launch without opening the scanner, and the module is never
 * evaluated — so nothing registers, `resetSessionScopedStores` iterates an empty
 * map, and A's scan history is still on disk for user B. `clearAuthFromStorage`
 * does not catch it either: that rewrites the ROOT storage blob, and each of
 * these stores persists under a key of its own.
 *
 * So persisted keys are declared as DATA in `SESSION_SCOPED_PERSISTED_KEYS`
 * below and deleted unconditionally, without loading the module that owns them.
 */
import { storage } from '#/storage/mmkv';

type StoreReset = () => void;

const stores = new Map<string, StoreReset>();

/**
 * Storage keys of feature-owned stores whose contents end with the session.
 *
 * Data, not a side effect of importing code — that is the whole point. Each
 * entry is the `name` passed to zustand's `persist` middleware in the store it
 * belongs to. A persisted feature store that is missing here survives a sign-out
 * on a shared device; `sessionEndLeavesNoData.test.ts` covers the unloaded case
 * that a registration-based check cannot see.
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
      console.warn(`[sessionScopedStores] "${name}" failed to reset`, error);
    }
  }

  // Independent of the loop above: a store whose module was never evaluated has
  // no registration, but its persisted key is still on disk.
  for (const key of SESSION_SCOPED_PERSISTED_KEYS) {
    try {
      storage.remove(key);
    } catch (error) {
      console.warn(`[sessionScopedStores] "${key}" failed to clear`, error);
    }
  }
};

/** Test seam. */
export const clearSessionScopedStores = (): void => {
  stores.clear();
};

/** The names currently registered, for tests that assert coverage. */
export const registeredSessionScopedStores = (): string[] => [...stores.keys()];
