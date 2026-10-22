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
 * Exercises the REAL `useStore.persist` options (partialize), not a rebuilt
 * copy, so a regression is caught here. Fields not in the
 * PERSISTED_KEYS allowlist are transient by default — the fail-safe
 * direction: forgetting to classify a field means it doesn't survive restart
 * (visible, one-line fix) instead of silently poisoning the blob.
 */

import { useStore, PERSISTED_KEYS } from '#store';
import { storage } from '#/store/deviceStorage';

// The recovery signal is controllable, so the plaintext-token guard in
// partialize is exercised without provoking a real device-key failure.
const recoveryMode = jest.spyOn(storage, 'isRecovery');

afterEach(() => {
  recoveryMode.mockReturnValue(false);
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

    it('persists the currency mirror alongside the user it belongs to', () => {
      // `user` is persisted, so a relaunch restores the session WITHOUT going
      // back through `setAuth`. Leaving the mirror out reset it to the USD
      // default and rendered a EUR account's costs in dollars.
      const keys = partializedKeys();
      expect(keys).toContain('user');
      expect(keys).toContain('preferredCurrency');
    });

    // A key LIST cannot show that a value survives the trip — only serializing
    // it and reading it back can, which is what a relaunch actually does.
    it.each([
      ['preferredCurrency', 'EUR'],
      // An opt-out whose default is the OPPOSITE of the user's choice: losing
      // it turns every tutorial back on for someone who switched them off.
      ['showTutorials', false],
    ])('round-trips %s through persist and rehydrate', (key, value) => {
      const { partialize } = useStore.persist.getOptions();
      const source = { ...useStore.getState(), [key]: value };

      const written = JSON.parse(JSON.stringify(partialize!(source)));

      expect(written).toHaveProperty(key, value);
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
      recoveryMode.mockReturnValue(true);

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
});
