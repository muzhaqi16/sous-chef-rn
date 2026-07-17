import { Platform } from 'react-native';
import { registerIosPushTapHandlers } from '../iosPushMessaging';
import { routeNotificationTap } from '../pushNotificationRouting';

const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();
const mockGetInitialNotification = jest.fn();

jest.mock('@react-native-community/push-notification-ios', () => ({
  __esModule: true,
  default: {
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
    removeEventListener: (...args: unknown[]) =>
      mockRemoveEventListener(...args),
    getInitialNotification: (...args: unknown[]) =>
      mockGetInitialNotification(...args),
    FetchResult: {
      NewData: 'UIBackgroundFetchResultNewData',
      NoData: 'UIBackgroundFetchResultNoData',
      ResultFailed: 'UIBackgroundFetchResultFailed',
    },
  },
}));

jest.mock('../pushNotificationRouting', () => ({
  routeNotificationTap: jest.fn(),
}));

const mockRouteTap = routeNotificationTap as jest.Mock;

const setPlatform = (os: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', { value: os, writable: true });
};

/** A PushNotification stub whose getData() returns the given userInfo. */
const notif = (data: Record<string, unknown>) => ({ getData: () => data });

const getTapHandler = (): ((n: { getData: () => unknown }) => void) => {
  const call = mockAddEventListener.mock.calls.find(
    c => c[0] === 'localNotification',
  );
  return call?.[1];
};

const getBackgroundHandler = (): ((n: {
  finish: (result: string) => void;
}) => void) => {
  const call = mockAddEventListener.mock.calls.find(
    c => c[0] === 'notification',
  );
  return call?.[1];
};

describe('registerIosPushTapHandlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setPlatform('ios');
    mockGetInitialNotification.mockResolvedValue(null);
  });

  it('does nothing on Android', () => {
    setPlatform('android');
    const unsubscribe = registerIosPushTapHandlers();
    expect(mockAddEventListener).not.toHaveBeenCalled();
    expect(mockGetInitialNotification).not.toHaveBeenCalled();
    expect(unsubscribe).toBeInstanceOf(Function);
  });

  it('routes a background tap via the notification userInfo category', () => {
    registerIosPushTapHandlers();
    getTapHandler()(notif({ category: 'PANTRY', notificationId: 'n1' }));
    expect(mockRouteTap).toHaveBeenCalledWith({
      category: 'PANTRY',
      notificationId: 'n1',
    });
  });

  it('routes a cold-launch tap from getInitialNotification', async () => {
    mockGetInitialNotification.mockResolvedValue(
      notif({ category: 'SHOPPING' }),
    );
    registerIosPushTapHandlers();
    await Promise.resolve();
    expect(mockRouteTap).toHaveBeenCalledWith({ category: 'SHOPPING' });
  });

  it('does not route when there is no cold-launch notification', async () => {
    registerIosPushTapHandlers();
    await Promise.resolve();
    expect(mockRouteTap).not.toHaveBeenCalled();
  });

  describe('InitialNotificationTap native cache', () => {
    const { NativeModules } = jest.requireActual('react-native') as {
      NativeModules: Record<string, unknown>;
    };

    afterEach(() => {
      delete NativeModules.InitialNotificationTap;
    });

    it('routes the natively cached launching tap and skips the fallback', async () => {
      const consume = jest
        .fn()
        .mockResolvedValue({ category: 'MEAL_PLAN', sourceId: 's1' });
      NativeModules.InitialNotificationTap = { consume };

      registerIosPushTapHandlers();
      await Promise.resolve();
      await Promise.resolve();

      expect(consume).toHaveBeenCalledTimes(1);
      expect(mockRouteTap).toHaveBeenCalledWith({
        category: 'MEAL_PLAN',
        sourceId: 's1',
      });
      expect(mockGetInitialNotification).not.toHaveBeenCalled();
    });

    it('does not route or fall back when the cache is empty', async () => {
      const consume = jest.fn().mockResolvedValue(null);
      NativeModules.InitialNotificationTap = { consume };

      registerIosPushTapHandlers();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockRouteTap).not.toHaveBeenCalled();
      expect(mockGetInitialNotification).not.toHaveBeenCalled();
    });
  });

  it('completes a silent/background notification by calling finish()', () => {
    registerIosPushTapHandlers();
    const finish = jest.fn();
    getBackgroundHandler()({ finish });
    expect(finish).toHaveBeenCalledWith('UIBackgroundFetchResultNoData');
    // Background pushes are not routed like taps.
    expect(mockRouteTap).not.toHaveBeenCalled();
  });

  it('unsubscribes both the localNotification and notification listeners', () => {
    const unsubscribe = registerIosPushTapHandlers();
    unsubscribe();
    expect(mockRemoveEventListener).toHaveBeenCalledWith('localNotification');
    expect(mockRemoveEventListener).toHaveBeenCalledWith('notification');
  });
});
