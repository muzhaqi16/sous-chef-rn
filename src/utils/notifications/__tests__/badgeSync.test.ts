import notifee from '@notifee/react-native';
import { useStore } from '#store';
import { logger } from '#/utils/environment';
import { setupBadgeSync } from '../badgeSync';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: { setBadgeCount: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('#store', () => ({
  useStore: { subscribe: jest.fn(() => jest.fn()) },
}));

const mockSetBadgeCount = notifee.setBadgeCount as jest.Mock;
const mockSubscribe = useStore.subscribe as unknown as jest.Mock;

/** The (selector, listener, options) the module passed to store.subscribe. */
const capture = () => {
  const [selector, listener, options] = mockSubscribe.mock.calls[0];
  return { selector, listener, options };
};

describe('setupBadgeSync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('subscribes to unreadCount and fires immediately', () => {
    setupBadgeSync();
    const { selector, options } = capture();
    expect(selector({ unreadCount: 7, other: 'x' })).toBe(7);
    expect(options).toEqual({ fireImmediately: true });
  });

  it('sets the OS badge to the unread count on change', () => {
    setupBadgeSync();
    capture().listener(3);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(3);
  });

  it('clears the badge to 0 when everything is read', () => {
    setupBadgeSync();
    capture().listener(0);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(0);
  });

  it('never sends a negative badge count', () => {
    setupBadgeSync();
    capture().listener(-1);
    expect(mockSetBadgeCount).toHaveBeenCalledWith(0);
  });

  it('logs and does not throw when setBadgeCount rejects', async () => {
    mockSetBadgeCount.mockRejectedValueOnce(new Error('no permission'));
    setupBadgeSync();
    expect(() => capture().listener(2)).not.toThrow();
    await Promise.resolve();
    expect(logger.error).toHaveBeenCalledWith(
      'setBadgeCount failed:',
      expect.any(Error),
    );
  });

  it('returns the store unsubscribe function', () => {
    const unsub = jest.fn();
    mockSubscribe.mockReturnValueOnce(unsub);
    expect(setupBadgeSync()).toBe(unsub);
  });
});
