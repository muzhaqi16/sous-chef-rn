import { handleStoreRehydration, useStore } from '../index';
import { errorService } from '#/services/errorService';

jest.mock('#/services/errorService', () => ({
  // User-facing copy, resolved from the error's code. Present so a suite
  // reaching the alert path does not fail on a missing export.
  localizedErrorMessage: jest.fn(() => 'Something went wrong.'),
  errorService: { reportError: jest.fn() },
}));

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
