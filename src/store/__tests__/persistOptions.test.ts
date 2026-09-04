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

// Keep the real MMKV module (zustandStorage, STORAGE_KEY) but make the
// recovery-instance signal controllable so the plaintext-token guard in
// partialize can be exercised without provoking a real device-key failure.
jest.mock('#/storage/mmkv', () => ({
  ...jest.requireActual('#/storage/mmkv'),
  isRecoveryStorage: jest.fn(() => false),
}));

import { useStore, PERSISTED_KEYS } from '#store';
import { isRecoveryStorage } from '#/storage/mmkv';

afterEach(() => {
  (isRecoveryStorage as jest.Mock).mockReturnValue(false);
});

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

    it('persists the offline autocomplete caches, including the seen-items LRU', () => {
      const keys = partializedKeys();
      expect(keys).toContain('cachedUnits');
      expect(keys).toContain('cachedStores');
      expect(keys).toContain('cachedBrands');
      expect(keys).toContain('cachedCategories');
      // The seen-items LRU must survive cold start so offline item autocomplete
      // keeps its fallback suggestions.
      expect(keys).toContain('cachedItemSuggestions');
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
      // v13 — hydration gate + auth lifecycle flags
      expect(keys).not.toContain('isHydrated');
      expect(keys).not.toContain('isAutoLoggingIn');
      expect(keys).not.toContain('isPantryQueryComplete');
      // v14 — the scanner owns its state, and its own persisted key
      expect(keys).not.toContain('recentlyScanned');
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

    it('never persists tokens to the unencrypted recovery instance', () => {
      const { partialize } = useStore.persist.getOptions();
      (isRecoveryStorage as jest.Mock).mockReturnValue(true);

      // Same doubly-degraded preconditions that would otherwise trip the
      // keychain-fallback: unconfirmed keychain copy + both tokens present.
      useStore.setState({
        accessToken: 'access-1',
        refreshToken: 'refresh-1',
        sessionTokensInKeychain: false,
      });
      const persisted = partialize!(useStore.getState()) as Record<
        string,
        unknown
      >;

      expect(persisted).not.toHaveProperty('accessToken');
      expect(persisted).not.toHaveProperty('refreshToken');
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

    it('sweeps a key that LEFT the allowlist, which no earlier version covers', async () => {
      // The reverse direction of the sweep, and the one with no natural
      // trigger: a v13 blob is otherwise migration-free, so `recentlyScanned`
      // would sit unreachable — and uncleared by a sign-out — until some
      // unrelated write happened to replace the blob.
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(
        {
          recentlyScanned: [{ id: 's1', name: 'Pregnancy test', upc: '01' }],
          theme: 'dark',
        },
        13,
      )) as Record<string, unknown>;

      expect(migrated).not.toHaveProperty('recentlyScanned');
      expect(migrated.theme).toBe('dark');
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

  describe('migrate (v15 unit-vocabulary drop)', () => {
    // The API merged 46 alias `Unit` rows away and rebased every conversion
    // factor, so a v14 blob's warmed units name ids the server cannot resolve.
    const v14Blob = () => ({
      cachedUnits: [{ id: 'unit-oz', symbol: 'oz', name: 'oz' }],
      lastUnitsFetchedAt: 1756900000000,
      cachedCategories: [{ id: 'cat-1', name: 'Produce' }],
      lastCategoriesFetchedAt: 1756900000000,
      theme: 'dark',
      selectedHomeId: 'home-1',
    });

    it('drops the warmed unit list and its stamp together', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(v14Blob(), 14)) as Record<
        string,
        unknown
      >;

      expect(migrated).not.toHaveProperty('cachedUnits');
      // Without this the list re-warms only after the 24h TTL, and until then
      // `localFirst` answers unit autocomplete from an empty local set.
      expect(migrated).not.toHaveProperty('lastUnitsFetchedAt');
    });

    it('leaves every other warmed catalog slice alone', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(v14Blob(), 14)) as Record<
        string,
        unknown
      >;

      expect(migrated.cachedCategories).toEqual([
        { id: 'cat-1', name: 'Produce' },
      ]);
      expect(migrated.lastCategoriesFetchedAt).toBe(1756900000000);
      expect(migrated.theme).toBe('dark');
      expect(migrated.selectedHomeId).toBe('home-1');
    });

    it('runs for a blob older than v14 too', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(v14Blob(), 12)) as Record<
        string,
        unknown
      >;

      expect(migrated).not.toHaveProperty('cachedUnits');
      expect(migrated).not.toHaveProperty('lastUnitsFetchedAt');
      expect(migrated.cachedCategories).toEqual([
        { id: 'cat-1', name: 'Produce' },
      ]);
    });

    it('carries feature hints and login counts out of the old MMKV keys', async () => {
      const { storage } = require('#/storage/mmkv');
      storage.set('feature_hint_shown_user-1_pantry_swipe', true);
      storage.set('feature_hint_shown_user-1_list_reorder', true);
      storage.set('login_count_user-1', 7);

      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!({}, 15)) as Record<string, unknown>;

      expect(migrated.featureHintsShown).toMatchObject({
        'feature_hint_shown_user-1_pantry_swipe': true,
        'feature_hint_shown_user-1_list_reorder': true,
      });
      expect(migrated.loginCounts).toMatchObject({ 'user-1': 7 });
    });

    it('removes the old keys once they are carried', async () => {
      const { storage } = require('#/storage/mmkv');
      storage.set('feature_hint_shown_user-2_thing', true);

      const { migrate } = useStore.persist.getOptions();
      await migrate!({}, 15);

      expect(storage.getAllKeys()).not.toContain(
        'feature_hint_shown_user-2_thing',
      );
    });

    it('leaves a v16 blob untouched', async () => {
      const { storage } = require('#/storage/mmkv');
      storage.set('feature_hint_shown_user-3_thing', true);

      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(
        { featureHintsShown: { existing: true } },
        16,
      )) as Record<string, unknown>;

      expect(migrated.featureHintsShown).toEqual({ existing: true });
    });

    it('leaves a v15 blob untouched', async () => {
      const { migrate } = useStore.persist.getOptions();
      const migrated = (await migrate!(v14Blob(), 15)) as Record<
        string,
        unknown
      >;

      expect(migrated.cachedUnits).toEqual([
        { id: 'unit-oz', symbol: 'oz', name: 'oz' },
      ]);
      expect(migrated.lastUnitsFetchedAt).toBe(1756900000000);
    });
  });
});
