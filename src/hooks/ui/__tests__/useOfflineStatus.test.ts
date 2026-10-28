import { renderHook } from '@testing-library/react-native';
import { useOfflineStatus } from '../useOfflineStatus';
import { usePendingMutationCount } from '#/hooks/offline/usePendingMutationCount';
import type { OfflineBannerCause } from '#store/slices/networkSlice';

let mockCause: OfflineBannerCause | null = null;

jest.mock('#store/useAppStore', () => ({
  useAppStore: (
    selector: (state: {
      offlineBannerCause: OfflineBannerCause | null;
    }) => unknown,
  ) => selector({ offlineBannerCause: mockCause }),
}));
jest.mock('#/hooks/offline/usePendingMutationCount');

const pendingCount = jest.mocked(usePendingMutationCount);

const statusFor = (cause: OfflineBannerCause | null, pending = 0) => {
  mockCause = cause;
  pendingCount.mockReturnValue(pending);
  return renderHook(() => useOfflineStatus()).result.current;
};

describe('useOfflineStatus', () => {
  it('reads online with no cause', () => {
    expect(statusFor(null).offline).toBe(false);
  });

  it.each([
    [
      'api-unreachable',
      "Can't reach the server",
      "Changes will sync when it's back",
      'cloud-offline-outline',
    ],
    [
      'device-offline',
      "You're offline",
      "Changes will sync when you're back online",
      'cloud-offline-outline',
    ],
    [
      'offline-mode',
      'Offline mode is on',
      "Using what's on this device only",
      'airplane-outline',
    ],
  ] as const)(
    'gives %s a short title and a detail',
    (cause, title, detail, iconName) => {
      expect(statusFor(cause)).toEqual({
        offline: true,
        iconName,
        title,
        detail,
        message: `${title}, ${detail}`,
        pendingCount: 0,
      });
    },
  );

  it.each([
    ['api-unreachable', 1, "1 change will sync when it's back"],
    ['api-unreachable', 3, "3 changes will sync when it's back"],
    ['device-offline', 1, "1 change will sync when you're back online"],
    ['device-offline', 3, "3 changes will sync when you're back online"],
  ] as const)(
    'counts what %s holds in the detail (%i)',
    (cause, pending, detail) => {
      const status = statusFor(cause, pending);

      expect(status.detail).toBe(detail);
      expect(status.pendingCount).toBe(pending);
    },
  );

  it('keeps offline mode about the device, whatever is pending', () => {
    expect(statusFor('offline-mode', 2).detail).toBe(
      "Using what's on this device only",
    );
  });

  it('reads the title and the detail as one label', () => {
    expect(statusFor('api-unreachable', 2).message).toBe(
      "Can't reach the server, 2 changes will sync when it's back",
    );
  });
});
