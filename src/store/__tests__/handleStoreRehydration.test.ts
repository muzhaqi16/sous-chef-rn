import { handleStoreRehydration, useStore } from '../index';
import { errorService } from '#/services/errorService';

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
