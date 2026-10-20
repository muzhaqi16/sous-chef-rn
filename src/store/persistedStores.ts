/**
 * Persisted stores hydrate when the host starts them, never as their module
 * loads: creating a store reads nothing, so loading the core reads no platform
 * service. Each one sets `skipHydration` and registers here; a store created
 * after the start hydrates as it registers.
 */
interface PersistedStore {
  persist: { rehydrate: () => Promise<void> | void };
}

// On `globalThis`, as the platform install is: a test that resets the module
// registry re-evaluates this file, and the start must outlive that.
const STARTED = Symbol.for('sous-chef.persistedStoresStarted');
const registry = globalThis as { [STARTED]?: boolean };

const waiting = new Set<PersistedStore>();

// persist's rehydrate reports a failure to the store's onRehydrateStorage.
const hydrate = (store: PersistedStore): void => {
  void store.persist.rehydrate();
};

export function hydrateWhenStarted(store: PersistedStore): void {
  if (registry[STARTED]) {
    hydrate(store);
    return;
  }
  waiting.add(store);
}

/** Called once by the host, right after it installs the platform. */
export function startPersistedStores(): void {
  if (registry[STARTED]) return;
  registry[STARTED] = true;
  for (const store of waiting) hydrate(store);
  waiting.clear();
}
