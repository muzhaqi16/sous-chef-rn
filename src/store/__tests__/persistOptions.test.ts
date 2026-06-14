/**
 * Guards on the production store's persist configuration.
 *
 * Persistence is an explicit allowlist (PERSISTED_KEYS) after the
 * "persisted derived state" bug class struck three times: `apiReachable`
 * froze the app in a permanent "server unreachable" state (v11), the
 * env-derived telemetry flags baked in a stale `enableLogs: false` that
 * silently killed log shipping (v12), and `isHydrated` + auth/scanner
 * lifecycle flags rode along undetected (v13).
 *
 * Exercises the REAL `useStore.persist` options (partialize + migrate), not a
 * rebuilt copy, so a regression in either is caught here. Fields not in the
 * PERSISTED_KEYS allowlist are transient by default — the fail-safe
 * direction: forgetting to classify a field means it doesn't survive restart
 * (visible, one-line fix) instead of silently poisoning the blob.
 */

// authSlice transitively imports tokenScheduler/refreshToken which need
// native AppState. Stub them so the store import is pure-JS — same pattern
// as the persistence integration tests.
jest.mock('../../apollo/links/tokenScheduler');
jest.mock('../../apollo/links/refreshToken');

import { useStore, PERSISTED_KEYS } from '#store';

const partializedKeys = (): string[] => {
  const { partialize } = useStore.persist.getOptions();
  return Object.keys(
    partialize!(useStore.getState()) as Record<string, unknown>,
  );
};

describe('store persist options', () => {
  describe('partialize', () => {
    it('emits exactly the PERSISTED_KEYS allowlist', () => {
      expect(partializedKeys().sort()).toEqual([...PERSISTED_KEYS].sort());
    });

    it('emits no functions (the old spread serialized every store action per write)', () => {
      const { partialize } = useStore.persist.getOptions();
      const persisted = partialize!(useStore.getState()) as Record<
        string,
        unknown
      >;
      const functionKeys = Object.keys(persisted).filter(
        key => typeof persisted[key] === 'function',
      );
      expect(functionKeys).toEqual([]);
    });

    it('regression: previously-leaked derived/session state stays transient', () => {
      const keys = partializedKeys();
      // v11 — circuit-breaker output
      expect(keys).not.toContain('apiReachable');
      // v12 — env-derived telemetry flags (userConsent is the user's choice)
      expect(keys).not.toContain('isEnabled');
      expect(keys).not.toContain('enableMetrics');
      expect(keys).not.toContain('enableLogs');
      expect(keys).not.toContain('enableConsoleInDev');
      expect(keys).toContain('userConsent');
      // v13 — hydration gate + auth/scanner lifecycle flags
      expect(keys).not.toContain('isHydrated');
      expect(keys).not.toContain('isAutoLoggingIn');
      expect(keys).not.toContain('isPantryQueryComplete');
      expect(keys).not.toContain('isScanning');
      expect(keys).not.toContain('scannedBarcode');
    });

    it('keeps the token pair in the blob only while the keychain copy is unconfirmed', () => {
      const { partialize } = useStore.persist.getOptions();

      useStore.setState({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        sessionTokensInKeychain: false,
      });
      const fallback = partialize!(useStore.getState()) as Record<
        string,
        unknown
      >;
      expect(fallback.accessToken).toBe('access-1');
      expect(fallback.refreshToken).toBe('refresh-1');

      useStore.setState({ sessionTokensInKeychain: true });
      const confirmed = partialize!(useStore.getState()) as Record<
        string,
        unknown
      >;
      expect(confirmed).not.toHaveProperty('accessToken');
      expect(confirmed).not.toHaveProperty('refreshToken');
    });
  });

  describe('migrate (v13 allowlist sweep)', () => {
    it('strips a stuck apiReachable flag from v10 blobs', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(
        { apiReachable: false, selectedHomeId: 'home-1' },
        10,
      )) as Record<string, unknown>;

      expect(migrated).not.toHaveProperty('apiReachable');
      expect(migrated.selectedHomeId).toBe('home-1');
    });

    it('strips persisted telemetry flags from v11 blobs but keeps userConsent', async () => {
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

    it('sweeps every non-allowlisted key from v12 blobs, including legacy unknowns', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(
        {
          isHydrated: true,
          isAutoLoggingIn: true,
          isScanning: true,
          searchResults: [{ id: '1' }],
          pendingPassword: 'hunter2', // legacy key not even in RootState
          theme: 'dark',
          selectedHomeId: 'home-1',
        },
        12,
      )) as Record<string, unknown>;

      expect(migrated).not.toHaveProperty('isHydrated');
      expect(migrated).not.toHaveProperty('isAutoLoggingIn');
      expect(migrated).not.toHaveProperty('isScanning');
      expect(migrated).not.toHaveProperty('searchResults');
      expect(migrated).not.toHaveProperty('pendingPassword');
      expect(migrated.theme).toBe('dark');
      expect(migrated.selectedHomeId).toBe('home-1');
    });

    it('the sweep spares the keychain-fallback token pair', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(
        {
          accessToken: 'access-1',
          refreshToken: 'refresh-1',
          apiReachable: false,
          user: { id: 'user-1' },
        },
        12,
      )) as Record<string, unknown>;

      expect(migrated.accessToken).toBe('access-1');
      expect(migrated.refreshToken).toBe('refresh-1');
      expect(migrated).not.toHaveProperty('apiReachable');
      expect(migrated.user).toEqual({ id: 'user-1' });
    });
  });
});
