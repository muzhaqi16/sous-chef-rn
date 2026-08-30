/**
 * Guard: the persisted Apollo cache must actually be restored.
 *
 * `restorePersistedCache()` cannot be a single inline call in
 * `initializeClient()`, which runs at module import. `initializeSecureStorage()`
 * is async (keychain-backed) and `index.js` does not await it, so at import time
 * `isStorageReady()` is false, `load()` returns null, and nothing is restored —
 * a session that only tries then writes a cache it never reads back. Offline
 * reads do not survive a relaunch, and `cache-and-network` hides that whenever
 * the device is online. So App retries at the hydration boundary, and the call
 * is idempotent.
 *
 * The defect is invisible to every other gate: it type-checks, lints, and
 * passes the suite, because nothing else asserts the restore happened.
 * Telemetry is what surfaces it (`app_apollo_restore_ms{outcome="empty"}`
 * beside a 79KB write).
 */
export {};

const mockIsStorageReady = jest.fn<boolean, []>();
const mockLoad = jest.fn();

jest.mock('#storage/mmkv', () => ({
  ...jest.requireActual('#storage/mmkv'),
  isStorageReady: () => mockIsStorageReady(),
  storage: { getString: jest.fn(), set: jest.fn(), remove: jest.fn() },
}));

jest.mock('#/apollo/offline/ApolloCachePersistence', () => ({
  apolloCachePersistence: {
    load: () => mockLoad(),
    save: jest.fn(),
    clear: jest.fn(),
    scheduleSave: jest.fn(),
  },
}));

function loadClient(): typeof import('#/apollo/client') {
  return require('#/apollo/client');
}

describe('persisted Apollo cache restore', () => {
  beforeEach(() => {
    jest.resetModules();
    mockIsStorageReady.mockReset();
    mockLoad.mockReset();
  });

  it('does not restore while storage is still initializing', () => {
    mockIsStorageReady.mockReturnValue(false);
    // `require`, not `await import()` — dynamic imports throw under this jest
    // config, which would make these assertions pass vacuously.
    const { restorePersistedCache } = loadClient();

    restorePersistedCache();

    expect(mockLoad).not.toHaveBeenCalled();
  });

  it('restores once storage is ready — the call at the hydration boundary', () => {
    // Module scope loads while storage is NOT ready, as in the real app.
    mockIsStorageReady.mockReturnValue(false);
    const { restorePersistedCache, client } = loadClient();
    expect(mockLoad).not.toHaveBeenCalled();

    // Hydration completes; storage is now ready and App calls again.
    mockIsStorageReady.mockReturnValue(true);
    mockLoad.mockReturnValue({
      'PantryItem:1': { __typename: 'PantryItem', id: '1' },
    });

    restorePersistedCache();

    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(client.cache.extract()).toHaveProperty('PantryItem:1');
  });

  it('is idempotent — a second call does not re-restore over live data', () => {
    mockIsStorageReady.mockReturnValue(true);
    mockLoad.mockReturnValue({
      'PantryItem:1': { __typename: 'PantryItem', id: '1' },
    });
    const { restorePersistedCache } = loadClient();

    // initializeClient() already restored at load, since storage was ready.
    expect(mockLoad).toHaveBeenCalledTimes(1);

    restorePersistedCache();
    restorePersistedCache();

    expect(mockLoad).toHaveBeenCalledTimes(1);
  });
});
