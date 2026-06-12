/**
 * Guards on the production store's persist configuration — specifically the
 * "stuck offline" bug class: `apiReachable` (the API-reachability circuit
 * breaker's output) leaking into the persisted MMKV blob. A session that ended
 * while the circuit was open rehydrated `apiReachable: false` over the fresh
 * optimistic default, and nothing ever flipped it back — the app showed
 * "Can't reach the server" forever until the user wiped app storage.
 *
 * Exercises the REAL `useStore.persist` options (partialize + migrate), not a
 * rebuilt copy, so a regression in either is caught here.
 */

// authSlice transitively imports tokenScheduler/refreshToken which need
// native AppState. Stub them so the store import is pure-JS — same pattern
// as the persistence integration tests.
jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

import { useStore } from '#store';

describe('store persist options', () => {
  it('partialize excludes transient network state (apiReachable et al.)', () => {
    const { partialize } = useStore.persist.getOptions();
    const persisted = partialize!(useStore.getState()) as Record<
      string,
      unknown
    >;

    expect(persisted).not.toHaveProperty('apiReachable');
    expect(persisted).not.toHaveProperty('isOnline');
    expect(persisted).not.toHaveProperty('isInternetReachable');
    expect(persisted).not.toHaveProperty('needsTokenRefresh');
    // Persisted via its own MMKV key, never through the blob.
    expect(persisted).not.toHaveProperty('offlineModeEnabled');
  });

  it('partialize excludes env-derived telemetry flags but keeps userConsent', () => {
    const { partialize } = useStore.persist.getOptions();
    const persisted = partialize!(useStore.getState()) as Record<
      string,
      unknown
    >;

    // Derived from the build environment every launch — persisting them once
    // froze a stale `enableLogs: false` into the blob and silently disabled
    // log shipping on every device.
    expect(persisted).not.toHaveProperty('isEnabled');
    expect(persisted).not.toHaveProperty('enableMetrics');
    expect(persisted).not.toHaveProperty('enableLogs');
    expect(persisted).not.toHaveProperty('enableConsoleInDev');
    // The one telemetry field that is a real user choice.
    expect(persisted).toHaveProperty('userConsent');
  });

  it('migrate v10→v11 strips a stuck apiReachable flag from old blobs', async () => {
    const { migrate } = useStore.persist.getOptions();
    const migrated = (await migrate!(
      { apiReachable: false, selectedHomeId: 'home-1' },
      10,
    )) as Record<string, unknown>;

    expect(migrated).not.toHaveProperty('apiReachable');
    expect(migrated.selectedHomeId).toBe('home-1');
  });

  it('migrate v11→v12 strips persisted telemetry flags but keeps userConsent', async () => {
    const { migrate } = useStore.persist.getOptions();
    const migrated = (await migrate!(
      {
        isEnabled: true,
        enableMetrics: true,
        enableLogs: false,
        enableConsoleInDev: false,
        userConsent: true,
        selectedHomeId: 'home-1',
      },
      11,
    )) as Record<string, unknown>;

    expect(migrated).not.toHaveProperty('isEnabled');
    expect(migrated).not.toHaveProperty('enableMetrics');
    expect(migrated).not.toHaveProperty('enableLogs');
    expect(migrated).not.toHaveProperty('enableConsoleInDev');
    expect(migrated.userConsent).toBe(true);
    expect(migrated.selectedHomeId).toBe('home-1');
  });
});
