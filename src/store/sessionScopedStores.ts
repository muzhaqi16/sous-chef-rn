/**
 * Stores that a feature owns, but that a session end must still clear.
 *
 * `SESSION_SCOPED_STATE` in `resetManager.ts` covers the ROOT store. A feature
 * that keeps its own zustand store is outside it by construction — which is how
 * `recipe-search-cache` and `recipe-suggestions-cache` came to survive logout.
 * A feature store registers its reset here instead, and `resetStore` calls the
 * registry.
 *
 * ## Why lazy registration is safe here, unlike elsewhere
 *
 * Metro runs with `inlineRequires`, so a feature module is not evaluated until
 * something uses it — which makes registration-on-import unreliable for a
 * registry that must answer questions about code it has never loaded (see the
 * offline queue's `SYNC_REGISTRY`, consulted on every mutation).
 *
 * This registry is the opposite case. A store can only hold data if something
 * imported it, and importing it runs this registration. A feature that never
 * loaded has nothing to clear, so an absent registration is not a missed reset —
 * it is an empty one.
 */
type StoreReset = () => void;

const stores = new Map<string, StoreReset>();

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
};

/** Test seam. */
export const clearSessionScopedStores = (): void => {
  stores.clear();
};

/** The names currently registered, for tests that assert coverage. */
export const registeredSessionScopedStores = (): string[] => [...stores.keys()];
