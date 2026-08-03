jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));
jest.mock('#/services/toastService', () => ({
  toastService: { info: jest.fn() },
}));
jest.mock('#/i18n/t', () => ({
  t: jest.fn((key: string) => key),
}));
jest.mock('../clientIdentity', () => ({
  CLIENT_VERSION: '4.2.1',
  CLIENT_NAME: 'sous-chef-app',
}));

const mockStore = new Map<string, string>();
jest.mock('#/storage/mmkv', () => ({
  isStorageReady: jest.fn(() => true),
  storage: {
    getString: jest.fn((key: string) => mockStore.get(key)),
    set: jest.fn((key: string, value: string) => {
      mockStore.set(key, value);
    }),
  },
}));

import { alertService } from '#/services/alertService';
import { isStorageReady } from '#/storage/mmkv';
import { toastService } from '#/services/toastService';
import {
  announceClientReleaseAvailable,
  announceClientUpgradeRequired,
  resetClientUpgradeNotice,
} from '../clientUpgradeNotice';

const alertMock = alertService.alert as jest.Mock;
const toastMock = toastService.info as jest.Mock;
const STORAGE_KEY = 'clientUpgradeNotice.announcedForVersion';

describe('announceClientUpgradeRequired', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isStorageReady as jest.Mock).mockReturnValue(true);
    mockStore.clear();
    resetClientUpgradeNotice();
  });

  it('shows a localized alert', () => {
    announceClientUpgradeRequired();

    expect(alertMock).toHaveBeenCalledWith(
      'appUpdate.title',
      'appUpdate.message',
    );
  });

  // The server refuses in didResolveOperation, so every in-flight query and
  // every socket reconnect produces the signal.
  it('announces only once within a launch, however many refusals arrive', () => {
    announceClientUpgradeRequired();
    announceClientUpgradeRequired();
    announceClientUpgradeRequired();

    expect(alertMock).toHaveBeenCalledTimes(1);
  });

  // No button is supplied, so alertService supplies its own single dismiss
  // button — nothing here may pin the alert open, since only a store update
  // clears the refusal.
  it('passes no buttons, leaving the default dismissable OK', () => {
    announceClientUpgradeRequired();

    expect(alertMock.mock.calls[0]).toHaveLength(2);
  });

  describe('across launches', () => {
    it('stays quiet on relaunch for a build already announced', () => {
      announceClientUpgradeRequired();
      expect(alertMock).toHaveBeenCalledTimes(1);

      // Fresh launch, same install: the in-memory guard is gone but the
      // persisted build is not.
      resetClientUpgradeNotice();
      announceClientUpgradeRequired();

      expect(alertMock).toHaveBeenCalledTimes(1);
    });

    it('announces again after the user updates to a build still below the floor', () => {
      mockStore.set(STORAGE_KEY, '4.1.0');

      announceClientUpgradeRequired();

      expect(alertMock).toHaveBeenCalledTimes(1);
      expect(mockStore.get(STORAGE_KEY)).toBe('4.2.1');
    });
  });

  // Announcing twice beats throwing inside the link chain.
  it('still announces when storage is not initialized yet', () => {
    (isStorageReady as jest.Mock).mockReturnValue(false);

    announceClientUpgradeRequired();

    expect(alertMock).toHaveBeenCalledTimes(1);
  });
});

// The soft nudge keys on the RECOMMENDED version, the opposite of the hard
// notice: the number that moves here is the server's, so each new release
// nudges once and an ignored one stays quiet until the next.
describe('announceClientReleaseAvailable', () => {
  const RECOMMENDED_KEY = 'clientUpgradeNotice.announcedRecommended';

  beforeEach(() => {
    jest.clearAllMocks();
    (isStorageReady as jest.Mock).mockReturnValue(true);
    mockStore.clear();
    resetClientUpgradeNotice();
  });

  it('shows a toast, not the blocking alert', () => {
    announceClientReleaseAvailable('4.3.0');

    expect(toastMock).toHaveBeenCalledWith('appUpdate.available');
    expect(alertMock).not.toHaveBeenCalled();
  });

  it('nudges once within a launch, however many responses carry it', () => {
    announceClientReleaseAvailable('4.3.0');
    announceClientReleaseAvailable('4.3.0');
    announceClientReleaseAvailable('4.3.0');

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(mockStore.get(RECOMMENDED_KEY)).toBe('4.3.0');
  });

  it('stays quiet on relaunch for a release already nudged', () => {
    announceClientReleaseAvailable('4.3.0');
    resetClientUpgradeNotice();
    announceClientReleaseAvailable('4.3.0');

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it('nudges again when the server recommends a newer release', () => {
    mockStore.set(RECOMMENDED_KEY, '4.3.0');

    announceClientReleaseAvailable('4.4.0');

    expect(toastMock).toHaveBeenCalledTimes(1);
    expect(mockStore.get(RECOMMENDED_KEY)).toBe('4.4.0');
  });

  // Opposite of the hard notice, deliberately: a duplicate nudge for a build
  // that still works is pure annoyance, so this one fails toward silence.
  it('stays silent when storage is not initialized yet', () => {
    (isStorageReady as jest.Mock).mockReturnValue(false);

    announceClientReleaseAvailable('4.3.0');

    expect(toastMock).not.toHaveBeenCalled();
  });

  it('does not disturb the blocking notice guard', () => {
    announceClientReleaseAvailable('4.3.0');
    announceClientUpgradeRequired();

    expect(alertMock).toHaveBeenCalledTimes(1);
  });
});
