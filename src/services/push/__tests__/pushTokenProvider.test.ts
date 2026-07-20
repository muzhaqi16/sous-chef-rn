import {
  acquirePushToken,
  onPushTokenRefresh,
  setPushTokenProvider,
  getPushTokenProvider,
  noopPushTokenProvider,
  type PushTokenProvider,
} from '../pushTokenProvider';

const makeProvider = (
  overrides: Partial<PushTokenProvider> = {},
): PushTokenProvider => ({
  requestPermission: jest.fn().mockResolvedValue(true),
  getToken: jest.fn().mockResolvedValue('tok-123'),
  onTokenRefresh: jest.fn(() => jest.fn()),
  ...overrides,
});

afterEach(() => {
  // Restore the default so tests don't leak the injected provider.
  setPushTokenProvider(noopPushTokenProvider);
});

describe('pushTokenProvider', () => {
  it('defaults to the no-op provider (no token, no permission)', async () => {
    expect(getPushTokenProvider()).toBe(noopPushTokenProvider);
    expect(await acquirePushToken()).toBeNull();
  });

  it('acquires a token from the injected provider when permission is granted', async () => {
    setPushTokenProvider(makeProvider());
    expect(await acquirePushToken()).toBe('tok-123');
  });

  it('returns null when OS permission is denied', async () => {
    setPushTokenProvider(
      makeProvider({ requestPermission: jest.fn().mockResolvedValue(false) }),
    );
    expect(await acquirePushToken()).toBeNull();
  });

  it('delegates token-refresh subscription to the active provider', () => {
    const unsub = jest.fn();
    const onTokenRefresh = jest.fn(() => unsub);
    setPushTokenProvider(makeProvider({ onTokenRefresh }));

    const cb = jest.fn();
    const returned = onPushTokenRefresh(cb);
    expect(onTokenRefresh).toHaveBeenCalledWith(cb);
    expect(returned).toBe(unsub);
  });
});
