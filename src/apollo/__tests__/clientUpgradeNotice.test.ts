import { storage } from '#/store/deviceStorage';

// The mocks are referenced through `mock*` bindings declared here rather than
// through the imported module objects, so they survive the `jest.resetModules()`
// that `freshLaunch()` uses — a re-registered factory closes over the same spies.
const mockToast = jest.fn();

jest.mock('#/services/toastService', () => ({
  toastService: { info: mockToast },
}));
jest.mock('#/i18n', () => ({
  t: jest.fn((key: string) => key),
}));
jest.mock('../clientIdentity', () => ({
  clientVersion: () => '4.2.1',
  CLIENT_NAME: 'sous-chef-app',
}));

// Device storage is the installed platform's, which outlives a module reset
// the way a device's storage outlives a relaunch.
const storageReady = jest.spyOn(storage, 'isReady');

const RECOMMENDED_KEY = 'clientUpgradeNotice.announcedRecommended';

/**
 * A fresh copy of the module, standing in for an app relaunch.
 *
 * The soft notice guards against repeats with module-level state that
 * deliberately outlives every call within a launch, so exercising the
 * across-launch behaviour means discarding the module rather than resetting it.
 * Device storage survives it — which is the whole distinction under test: the
 * in-memory guard is gone, the persisted one is not.
 */
const freshLaunch = (): typeof import('../clientUpgradeNotice') => {
  jest.resetModules();
  return require('../clientUpgradeNotice');
};

beforeEach(() => {
  jest.clearAllMocks();
  storageReady.mockReturnValue(true);
  storage.clearAll();
});

// The nudge keys on the RECOMMENDED version: the number that moves here is the
// server's, so each new release nudges once and an ignored one stays quiet
// until the next.
describe('announceClientReleaseAvailable', () => {
  it('shows a toast', () => {
    freshLaunch().announceClientReleaseAvailable('4.3.0');

    expect(mockToast).toHaveBeenCalledWith('appUpdate.available');
  });

  it('nudges once within a launch, however many responses carry it', () => {
    const notice = freshLaunch();
    notice.announceClientReleaseAvailable('4.3.0');
    notice.announceClientReleaseAvailable('4.3.0');
    notice.announceClientReleaseAvailable('4.3.0');

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(storage.getString(RECOMMENDED_KEY)).toBe('4.3.0');
  });

  it('stays quiet on relaunch for a release already nudged', () => {
    freshLaunch().announceClientReleaseAvailable('4.3.0');
    freshLaunch().announceClientReleaseAvailable('4.3.0');

    expect(mockToast).toHaveBeenCalledTimes(1);
  });

  it('nudges again when the server recommends a newer release', () => {
    storage.set(RECOMMENDED_KEY, '4.3.0');

    freshLaunch().announceClientReleaseAvailable('4.4.0');

    expect(mockToast).toHaveBeenCalledTimes(1);
    expect(storage.getString(RECOMMENDED_KEY)).toBe('4.4.0');
  });

  // A duplicate nudge for a build that still works is pure annoyance, so this
  // fails toward silence.
  it('stays silent when storage is not initialized yet', () => {
    storageReady.mockReturnValue(false);

    freshLaunch().announceClientReleaseAvailable('4.3.0');

    expect(mockToast).not.toHaveBeenCalled();
  });
});
