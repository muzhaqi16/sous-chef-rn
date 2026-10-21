import { storage } from '#/store/deviceStorage';

// The mocks are referenced through `mock*` bindings declared here rather than
// through the imported module objects, so they survive the `jest.resetModules()`
// that `freshLaunch()` uses — a re-registered factory closes over the same spies.
const mockAlert = jest.fn();
const mockToast = jest.fn();

jest.mock('#/services/alertService', () => ({
  alertService: { alert: mockAlert },
}));
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

const STORAGE_KEY = 'clientUpgradeNotice.announcedForVersion';
const RECOMMENDED_KEY = 'clientUpgradeNotice.announcedRecommended';

/**
 * A fresh copy of the module, standing in for an app relaunch.
 *
 * Both notices guard against repeats with module-level state that deliberately
 * outlives every call within a launch, so exercising the across-launch behaviour
 * means discarding the module rather than resetting it. Device storage survives
 * it — which is the whole distinction under test: the in-memory guard is gone,
 * the persisted one is not.
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

describe('announceClientUpgradeRequired', () => {
  it('shows a localized alert', () => {
    freshLaunch().announceClientUpgradeRequired();

    expect(mockAlert).toHaveBeenCalledWith(
      'appUpdate.title',
      'appUpdate.message',
    );
  });

  // The server refuses in didResolveOperation, so every in-flight query and
  // every socket reconnect produces the signal.
  it('announces only once within a launch, however many refusals arrive', () => {
    const notice = freshLaunch();
    notice.announceClientUpgradeRequired();
    notice.announceClientUpgradeRequired();
    notice.announceClientUpgradeRequired();

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  // No button is supplied, so alertService supplies its own single dismiss
  // button — nothing here may pin the alert open, since only a store update
  // clears the refusal.
  it('passes no buttons, leaving the default dismissable OK', () => {
    freshLaunch().announceClientUpgradeRequired();

    expect(mockAlert.mock.calls[0]).toHaveLength(2);
  });

  describe('across launches', () => {
    it('stays quiet on relaunch for a build already announced', () => {
      freshLaunch().announceClientUpgradeRequired();
      expect(mockAlert).toHaveBeenCalledTimes(1);

      freshLaunch().announceClientUpgradeRequired();

      expect(mockAlert).toHaveBeenCalledTimes(1);
    });

    it('announces again after the user updates to a build still below the floor', () => {
      storage.set(STORAGE_KEY, '4.1.0');

      freshLaunch().announceClientUpgradeRequired();

      expect(mockAlert).toHaveBeenCalledTimes(1);
      expect(storage.getString(STORAGE_KEY)).toBe('4.2.1');
    });
  });

  // Announcing twice beats throwing inside the link chain.
  it('still announces when storage is not initialized yet', () => {
    storageReady.mockReturnValue(false);

    freshLaunch().announceClientUpgradeRequired();

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });

  // The persisted guard is what silences future launches, so it must not be
  // spent on a notice the user never saw.
  it('records the announced build only after the alert is raised', () => {
    mockAlert.mockImplementationOnce(() => {
      expect(storage.getString(STORAGE_KEY)).toBeUndefined();
    });

    freshLaunch().announceClientUpgradeRequired();

    expect(mockAlert).toHaveBeenCalledTimes(1);
    expect(storage.getString(STORAGE_KEY)).toBe('4.2.1');
  });
});

// The soft nudge keys on the RECOMMENDED version, the opposite of the hard
// notice: the number that moves here is the server's, so each new release
// nudges once and an ignored one stays quiet until the next.
describe('announceClientReleaseAvailable', () => {
  it('shows a toast, not the blocking alert', () => {
    freshLaunch().announceClientReleaseAvailable('4.3.0');

    expect(mockToast).toHaveBeenCalledWith('appUpdate.available');
    expect(mockAlert).not.toHaveBeenCalled();
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

  // Opposite of the hard notice, deliberately: a duplicate nudge for a build
  // that still works is pure annoyance, so this one fails toward silence.
  it('stays silent when storage is not initialized yet', () => {
    storageReady.mockReturnValue(false);

    freshLaunch().announceClientReleaseAvailable('4.3.0');

    expect(mockToast).not.toHaveBeenCalled();
  });

  it('does not disturb the blocking notice guard', () => {
    const notice = freshLaunch();
    notice.announceClientReleaseAvailable('4.3.0');
    notice.announceClientUpgradeRequired();

    expect(mockAlert).toHaveBeenCalledTimes(1);
  });
});
