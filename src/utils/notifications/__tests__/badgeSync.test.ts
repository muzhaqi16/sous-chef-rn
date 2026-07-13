import notifee from '@notifee/react-native';
import { useStore } from '#store';
import { logger } from '#/utils/environment';
import { setupBadgeSync } from '../badgeSync';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { setBadgeCount: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('#store', () => ({
  useStore: { subscribe: jest.fn(() => jest.fn()), getState: jest.fn() },
}));

const mockSetBadgeCount = notifee.setBadgeCount as jest.Mock;
const mockSubscribe = useStore.subscribe as unknown as jest.Mock;
const mockGetState = useStore.getState as unknown as jest.Mock;

/** The unreadCount subscription (selector, listener, options) — call index 0. */
const captureCount = () => {
  const [selector, listener, options] = mockSubscribe.mock.calls[0];
  return { selector, listener, options };
};

/** The isHydrated subscription (selector, listener) — call index 1. */
const captureHydration = () => {
  const [selector, listener] = mockSubscribe.mock.calls[1];
  return { selector, listener };
};

describe('setupBadgeSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({ isHydrated: true, unreadCount: 0 });
  });

  it('subscribes to unreadCount (fireImmediately) and to isHydrated', () => {
    setupBadgeSync();
    const count = captureCount();
    expect(count.selector({ unreadCount: 7 })).toBe(7);
    expect(count.options).toEqual({ fireImmediately: true });
    const hydration = captureHydration();
    expect(hydration.selector({ isHydrated: true })).toBe(true);
  });

  it('does not apply a badge before hydration', () => {
    mockGetState.mockReturnValue({ isHydrated: false, unreadCount: 0 });
    setupBadgeSync();
    // The fireImmediately(0) at a cold start must not stomp a server-set badge.
    captureCount().listener(0);
    expect(mockSetBadgeCount).not.toHaveBeenCalled();
  });

  it('applies the unread count once the store is hydrated', () => {
    setupBadgeSync();
    captureCount().listener(3);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(3);
  });

  it('applies the hydrated count when the hydration flag flips true', () => {
    mockGetState.mockReturnValue({ isHydrated: true, unreadCount: 4 });
    setupBadgeSync();
    captureHydration().listener(true);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(4);
  });

  it('does not apply when the hydration flag is still false', () => {
    mockGetState.mockReturnValue({ isHydrated: false, unreadCount: 4 });
    setupBadgeSync();
    captureHydration().listener(false);
    expect(mockSetBadgeCount).not.toHaveBeenCalled();
  });

  it('never sends a negative badge count', () => {
    setupBadgeSync();
    captureCount().listener(-1);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(0);
  });

  it('logs and does not throw when setBadgeCount rejects', async () => {
    mockSetBadgeCount.mockRejectedValueOnce(new Error('no permission'));
    setupBadgeSync();
    expect(() => captureCount().listener(2)).not.toThrow();
    await Promise.resolve();
    expect(logger.error).toHaveBeenCalledWith(
      'setBadgeCount failed:',
      expect.any(Error),
    );
  });

  it('returns a function that unsubscribes both subscriptions', () => {
    const unsubCount = jest.fn();
    const unsubHydration = jest.fn();
    mockSubscribe
      .mockReturnValueOnce(unsubCount)
      .mockReturnValueOnce(unsubHydration);
    const teardown = setupBadgeSync();
    teardown();
    expect(unsubCount).toHaveBeenCalledTimes(1);
    expect(unsubHydration).toHaveBeenCalledTimes(1);
  });
});
