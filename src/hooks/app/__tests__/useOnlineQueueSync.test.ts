/**
 * Guard: queued writes must replay when the app starts already-online.
 *
 * `App` calls `useAppLifecycle()` BEFORE its `isHydrated` guard, so this hook
 * mounts on the first render with the store not yet hydrated. The effect ran,
 * `processQueue` found no authenticated user and skipped — and because
 * `isOnline` defaults to `true` and never changes on an online launch, the
 * effect never ran again.
 *
 * Observed on device: two writes made offline survived a full app restart with
 * connectivity available and were never attempted. Toggling connectivity while
 * the app was running replayed both immediately.
 */
import { renderHook } from '@testing-library/react-native';
import { useOnlineQueueSync } from '../useOnlineQueueSync';
import { queueManager } from '#/apollo/offlineQueue/queueManager';

let mockIsOnline = true;
let mockUserId: string | undefined;
let mockHasToken = false;

jest.mock('#store/useAppStore', () => ({
  useIsOnline: () => mockIsOnline,
  useUserId: () => mockUserId,
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({ accessToken: mockHasToken ? 'token' : null }),
}));

let mockNeedsRefresh = false;
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      needsTokenRefresh: mockNeedsRefresh,
      refreshToken: mockNeedsRefresh ? 'refresh-token' : null,
      setNeedsTokenRefresh: jest.fn(),
    }),
  },
}));

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { onOnline: jest.fn(), onOffline: jest.fn() },
}));
jest.mock('#/apollo/links/apiReachabilityBreaker', () => ({
  apiReachabilityBreaker: { reset: jest.fn(), onDeviceOffline: jest.fn() },
}));
jest.mock('#/apollo/links/wsLink', () => ({
  resumeWebSocketAfterOnline: jest.fn(),
}));
const mockRefresh = jest.fn(() => new Promise<string | null>(() => {}));
jest.mock('#/apollo/links/refreshToken', () => ({
  proactiveTokenRefresh: () => mockRefresh(),
}));

describe('useOnlineQueueSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockUserId = undefined;
    mockHasToken = false;
    mockNeedsRefresh = false;
  });

  it('drains once the user lands, even though connectivity never changed', () => {
    // First render mirrors the real one: online, but the store has not hydrated
    // so there is no authenticated user yet.
    const { rerender } = renderHook(() => useOnlineQueueSync());
    expect(queueManager.onOnline).toHaveBeenCalledTimes(1);

    // Hydration completes. `isOnline` is unchanged — this is the case that used
    // to leave the queue untouched until connectivity happened to flap.
    mockUserId = 'user-1';
    mockHasToken = true;
    rerender({});

    expect(queueManager.onOnline).toHaveBeenCalledTimes(2);
  });

  it('drains when the keychain token arrives after the persisted user', () => {
    // `user` is in PERSISTED_KEYS and restored from MMKV synchronously, but
    // `accessToken` lives in the keychain and is restored asynchronously. So the
    // first render already has a user and no token: `processQueue` skips with
    // "no authenticated user", and before this there was no trigger for when
    // the token landed.
    mockUserId = 'user-1';
    mockHasToken = false;

    const { rerender } = renderHook(() => useOnlineQueueSync());
    expect(queueManager.onOnline).toHaveBeenCalledTimes(1);

    mockHasToken = true;
    rerender({});

    expect(queueManager.onOnline).toHaveBeenCalledTimes(2);
  });

  it('drains even when a deferred token refresh never settles', () => {
    // The drain used to be called only from the refresh promise's
    // `.then`/`.catch`. `proactiveTokenRefresh` hands every later caller the
    // existing in-flight promise and only the ORIGINAL caller's `finally`
    // resets the state, and `performTokenRefresh` has no timeout over its
    // backoff-retry loop — so one stuck refresh stranded the queue silently.
    mockNeedsRefresh = true;
    mockUserId = 'user-1';
    mockHasToken = true;

    renderHook(() => useOnlineQueueSync());

    expect(mockRefresh).toHaveBeenCalled();
    // Never resolves, yet the drain still happens.
    expect(queueManager.onOnline).toHaveBeenCalled();
  });

  it('still pauses the queue when the device goes offline', () => {
    mockUserId = 'user-1';
    const { rerender } = renderHook(() => useOnlineQueueSync());

    mockIsOnline = false;
    rerender({});

    expect(queueManager.onOffline).toHaveBeenCalled();
  });

  it('does not re-drain on an unrelated re-render', () => {
    mockUserId = 'user-1';
    const { rerender } = renderHook(() => useOnlineQueueSync());
    expect(queueManager.onOnline).toHaveBeenCalledTimes(1);

    rerender({});

    expect(queueManager.onOnline).toHaveBeenCalledTimes(1);
  });
});
