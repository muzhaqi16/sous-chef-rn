import { handleStoreRehydration, useStore } from '../index';
import { errorService } from '#/services/errorService';
import { openedWithEmptyStore } from '#/storage/mmkv';
import { clearSessionTokens, loadSessionTokens } from '#/storage/keychain';

jest.mock('#/services/errorService');
jest.mock('#/storage/mmkv');
jest.mock('#/storage/keychain');

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
  const emptyStore = openedWithEmptyStore as jest.Mock;
  const clearTokens = clearSessionTokens as jest.Mock;
  const loadTokens = loadSessionTokens as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    emptyStore.mockReturnValue(false);
    loadTokens.mockResolvedValue({ status: 'absent' });
  });

  it('clears stored tokens and never reads them back', async () => {
    emptyStore.mockReturnValue(true);
    const setTokens = jest.fn();
    useStore.setState({ isHydrated: false });

    handleStoreRehydration({ ...useStore.getState(), setTokens }, undefined);
    await new Promise(resolve => setImmediate(resolve));

    expect(clearTokens).toHaveBeenCalled();
    expect(setTokens).not.toHaveBeenCalled();
    expect(useStore.getState().isHydrated).toBe(true);
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
