import { handleStoreRehydration, useStore } from '../index';
import { createTestStore } from '#/test-utils/createTestStore';
import { errorService } from '#/services/errorService';
import { storage } from '#/store/deviceStorage';
import { requirePlatform } from '#platform/install';

jest.mock('#/services/errorService');

describe('handleStoreRehydration', () => {
  it('recovers isHydrated and reports to telemetry when rehydration fails', async () => {
    useStore.setState({ isHydrated: false });

    const err = new Error('rehydrate boom');
    handleStoreRehydration(undefined, err);

    // isHydrated must flip even on failure, or RootNavigator hangs forever on
    // the loading screen (it gates first paint on isHydrated).
    expect(useStore.getState().isHydrated).toBe(true);
    expect(errorService.reportError).toHaveBeenCalledWith(err, {
      operation: 'storeHydration',
    });
  });

  describe('the currency mirror and the account record', () => {
    // Both come back from the same blob. The record is authoritative: the
    // mirror can be stale if the currency changed on another device since this
    // one last ran `setAuth`.
    it('prefers the record when they disagree', () => {
      const state = {
        user: { id: 'u1', preferredCurrency: 'EUR' },
        preferredCurrency: 'USD',
        setHydrated: jest.fn(),
      } as unknown as Parameters<typeof handleStoreRehydration>[0];

      handleStoreRehydration(state, undefined);

      expect(state!.preferredCurrency).toBe('EUR');
    });

    it('leaves the mirror alone when the record names no currency', () => {
      const state = {
        user: { id: 'u1', preferredCurrency: null },
        preferredCurrency: 'EUR',
        setHydrated: jest.fn(),
      } as unknown as Parameters<typeof handleStoreRehydration>[0];

      handleStoreRehydration(state, undefined);

      expect(state!.preferredCurrency).toBe('EUR');
    });

    // A pick that saved writes the record as well as the mirror
    // (`useCurrencyPreference`), so the relaunch keeps it rather than putting
    // back the currency the account signed in with.
    it('keeps a currency picked and saved since sign-in', () => {
      const store = createTestStore({
        user: {
          id: 'u1',
          email: 'ada@example.com',
          emailVerified: true,
          onBoarded: true,
          preferredCurrency: 'USD',
        },
        preferredCurrency: 'USD',
      });
      store.getState().setPreferredCurrency('EUR');
      store.getState().updateUser({ preferredCurrency: 'EUR' });

      // What a relaunch reads back: the persisted slice, through JSON.
      const { partialize } = useStore.persist.getOptions();
      const restored = {
        ...JSON.parse(JSON.stringify(partialize!(store.getState()))),
        setHydrated: jest.fn(),
      } as Parameters<typeof handleStoreRehydration>[0];

      handleStoreRehydration(restored, undefined);

      expect(restored!.user?.preferredCurrency).toBe('EUR');
      expect(restored!.preferredCurrency).toBe('EUR');
    });

    it("puts back the record's currency over a pick the record never took", () => {
      // The mirror alone moved: the launch restores what the account holds.
      const store = createTestStore({
        user: {
          id: 'u1',
          email: 'ada@example.com',
          emailVerified: true,
          onBoarded: true,
          preferredCurrency: 'USD',
        },
        preferredCurrency: 'USD',
      });
      store.getState().setPreferredCurrency('EUR');

      const { partialize } = useStore.persist.getOptions();
      const restored = {
        ...JSON.parse(JSON.stringify(partialize!(store.getState()))),
        setHydrated: jest.fn(),
      } as Parameters<typeof handleStoreRehydration>[0];

      handleStoreRehydration(restored, undefined);

      expect(restored!.preferredCurrency).toBe('USD');
    });
  });

  it('does not report to telemetry on successful rehydration', () => {
    (errorService.reportError as jest.Mock).mockClear();

    const state = useStore.getState();
    handleStoreRehydration(state, undefined);

    expect(errorService.reportError).not.toHaveBeenCalled();
    expect(useStore.getState().isHydrated).toBe(true);
  });
});

describe('home selection readiness', () => {
  it('does not raise the flag from a restored home/pantry pair', () => {
    const setIsHomeSelectionReady = jest.fn();

    handleStoreRehydration(
      {
        ...useStore.getState(),
        selectedHomeId: 'home-1',
        selectedPantryId: 'pantry-1',
        setIsHomeSelectionReady,
      },
      undefined,
    );

    // Restored is not valid: the pair may name a home the account has since
    // left, and this flag is what opens the pantry query's gate.
    expect(setIsHomeSelectionReady).not.toHaveBeenCalled();
  });
});

/**
 * A keychain item outlives the app on iOS, so a reinstalled app can find a
 * previous owner's session tokens with no local state behind them. The
 * encrypted store opening empty is the signal that nothing stands behind them.
 */
describe('a fresh install does not resume a session', () => {
  const emptyStore = jest.spyOn(storage, 'openedWithEmptyStore');
  const secureStore = requirePlatform('secureStore');
  const clearTokens = jest.spyOn(secureStore, 'clearSessionTokens');
  const loadTokens = jest.spyOn(secureStore, 'loadSessionTokens');
  const parkRevocation = jest.spyOn(secureStore, 'addPendingRevocation');

  beforeEach(() => {
    jest.clearAllMocks();
    emptyStore.mockReturnValue(false);
    loadTokens.mockResolvedValue({ status: 'absent' });
  });

  it('clears stored tokens and never resumes them', async () => {
    emptyStore.mockReturnValue(true);
    const setTokens = jest.fn();
    useStore.setState({ isHydrated: false });

    handleStoreRehydration({ ...useStore.getState(), setTokens }, undefined);
    await new Promise(resolve => setImmediate(resolve));

    expect(clearTokens).toHaveBeenCalled();
    expect(setTokens).not.toHaveBeenCalled();
    expect(useStore.getState().isHydrated).toBe(true);
  });

  // Its lineage is still live server-side, and the server pushes to a live one.
  it('parks the abandoned session for revocation before clearing it', async () => {
    emptyStore.mockReturnValue(true);
    const tokens = { accessToken: 'a', refreshToken: 'r' };
    loadTokens.mockResolvedValue({ status: 'ok', tokens });
    const setTokens = jest.fn();

    handleStoreRehydration({ ...useStore.getState(), setTokens }, undefined);
    await new Promise(resolve => setImmediate(resolve));

    expect(parkRevocation).toHaveBeenCalledWith(tokens);
    expect(clearTokens).toHaveBeenCalled();
    expect(setTokens).not.toHaveBeenCalled();
  });

  it('restores the session normally when the store has data', async () => {
    emptyStore.mockReturnValue(false);
    loadTokens.mockResolvedValue({
      status: 'ok',
      tokens: { accessToken: 'a', refreshToken: 'r' },
    });
    const setTokens = jest.fn();

    handleStoreRehydration({ ...useStore.getState(), setTokens }, undefined);
    await new Promise(resolve => setImmediate(resolve));

    expect(clearTokens).not.toHaveBeenCalled();
    expect(setTokens).toHaveBeenCalled();
  });
});
