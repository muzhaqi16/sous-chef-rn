// Device-lifecycle behaviors of authService:
//  - P2-13: the getToken-timeout dead window — a push token that materializes
//    after acquirePushToken timed out (null) but before the refresh listener
//    subscribed is re-checked after subscribe and pushed to the server.
//  - P2-11: logout tears down the prior user's push/notification state —
//    deregisters the device (updateDevice delete:true), unsubscribes the refresh
//    listener, and resets notification state; a deregister failure never blocks
//    the local teardown.
//
// authService uses the singleton Apollo client and reads module boundaries, so
// each dependency is mocked at its module edge (the pattern in
// authService.register.test.ts).

const mockMutate = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: { mutate: (...args: unknown[]) => mockMutate(...args) },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStoreState: Record<string, unknown> = {};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
}));

jest.mock('#/utils/deviceInfo', () => ({
  collectDeviceInformation: jest
    .fn()
    .mockResolvedValue({ deviceId: 'local-1' }),
  validateDeviceInformation: jest.fn().mockReturnValue(true),
}));

const mockPermissionCheck = jest.fn().mockResolvedValue('granted');
jest.mock('#/services/permissions/PermissionService', () => ({
  PermissionService: { check: (...a: unknown[]) => mockPermissionCheck(...a) },
}));

const mockAcquireToken = jest.fn();
const mockGetToken = jest.fn();
const mockUnsubscribe = jest.fn();
const mockOnRefresh = jest.fn(() => mockUnsubscribe);
jest.mock('#/services/push/pushTokenProvider', () => ({
  acquirePushToken: () => mockAcquireToken(),
  getPushTokenProvider: () => ({ getToken: () => mockGetToken() }),
  onPushTokenRefresh: () => mockOnRefresh(),
}));

const mockPerformLogoutCleanup = jest.fn().mockResolvedValue(undefined);
const mockCompleteLogout = jest.fn();
jest.mock('#/apollo/logoutCleanup', () => ({
  LogoutCleanup: {
    performLogoutCleanup: (...a: unknown[]) => mockPerformLogoutCleanup(...a),
    completeLogout: (...a: unknown[]) => mockCompleteLogout(...a),
  },
}));

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { onLogout: jest.fn(), onUserChange: jest.fn() },
}));

jest.mock('#/storage/keychain', () => ({
  removeBiometricCredentials: jest.fn().mockResolvedValue(true),
  clearTempRegistrationPassword: jest.fn().mockResolvedValue(undefined),
}));

import { authService } from '#/services/authService';

/** Route client.mutate by input shape: RegisterDevice carries `deviceId`. */
const routeMutate = () =>
  mockMutate.mockImplementation(({ variables }) => {
    const input = (variables?.input ?? {}) as Record<string, unknown>;
    if ('deviceId' in input) {
      return Promise.resolve({
        data: {
          registerDevice: {
            __typename: 'RegisterDevicePayload',
            device: { id: 'srv-1' },
          },
        },
      });
    }
    return Promise.resolve({
      data: {
        updateDevice: {
          __typename: 'UpdateDevicePayload',
          device: { id: 'srv-1' },
        },
      },
    });
  });

/** Flush the fire-and-forget registration promise chain. */
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};

/**
 * UpdateDevice call inputs carrying the given key. UpdateDevice inputs use `id`;
 * RegisterDevice uses `deviceId` (and always carries a `pushToken` key), so
 * requiring `id` excludes the registration call.
 */
const updateCallsWith = (key: string) =>
  mockMutate.mock.calls
    .map(([opts]) => opts?.variables?.input)
    .filter(
      (input): input is Record<string, unknown> =>
        !!input && 'id' in input && key in input,
    );

beforeEach(() => {
  jest.clearAllMocks();
  routeMutate();
  Object.assign(mockStoreState, {
    user: null,
    clearAuth: jest.fn(),
    resetStore: jest.fn(() => Promise.resolve()),
    setNavigationState: jest.fn(),
    getUserNavigationState: jest.fn(() => ({})),
    setUserNavigationState: jest.fn(),
  });
});

/** The RegisterDevice input (it carries `deviceId`, not `id`). */
const registerCall = () =>
  mockMutate.mock.calls
    .map(([opts]) => opts?.variables?.input)
    .find(
      (input): input is Record<string, unknown> =>
        !!input && 'deviceId' in input,
    );

/**
 * Revoking OS notifications leaves the FCM token valid, so nothing server-side
 * reports the device unreachable and the dead-token pruning never fires. The
 * client is the only party that knows, and registration is where it says so.
 */
describe('registerDeviceInBackground — push token write intent', () => {
  it('sends the token it acquired when permission is granted', async () => {
    mockPermissionCheck.mockResolvedValueOnce('granted');
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');

    authService.registerDeviceInBackground();
    await flush();

    expect(registerCall()).toMatchObject({ pushToken: 'apns-1' });
  });

  it('clears the stored token when permission is not granted', async () => {
    mockPermissionCheck.mockResolvedValueOnce('blocked');

    authService.registerDeviceInBackground();
    await flush();

    expect(registerCall()?.pushToken).toBeNull();
    // The provider is never consulted — a blocked permission cannot yield one.
    expect(mockAcquireToken).not.toHaveBeenCalled();
  });

  /**
   * A timed-out acquire is not evidence the device is unreachable, so the field
   * is omitted and the server keeps whatever it already holds. The dead-window
   * re-check below is what delivers the token if it turns up late.
   */
  it('leaves the stored token alone when acquisition fails under a grant', async () => {
    mockPermissionCheck.mockResolvedValueOnce('granted');
    mockAcquireToken.mockResolvedValueOnce(null);
    mockGetToken.mockResolvedValueOnce(null);

    authService.registerDeviceInBackground();
    await flush();

    expect(registerCall()?.pushToken).toBeUndefined();
  });
});

describe('registerDeviceInBackground — getToken dead-window re-check (P2-13)', () => {
  it('sends a token that materialized after the acquire timeout', async () => {
    // acquirePushToken timed out (null); the token arrives before the re-check.
    mockAcquireToken.mockResolvedValueOnce(null);
    mockGetToken.mockResolvedValueOnce('apns-late');

    authService.registerDeviceInBackground();
    await flush();

    // The device was registered (with no token) then updated with the late one.
    const updates = updateCallsWith('pushToken');
    expect(updates).toContainEqual(
      expect.objectContaining({ id: 'srv-1', pushToken: 'apns-late' }),
    );
  });

  it('does not send a spurious update when the token is unchanged', async () => {
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');

    authService.registerDeviceInBackground();
    await flush();

    // No updateDevice(pushToken) — the token at registration already matched.
    expect(updateCallsWith('pushToken')).toHaveLength(0);
  });
});

describe('logout — push/notification teardown (P2-11)', () => {
  it('deregisters the device, unsubscribes the listener, and resets notifications', async () => {
    // Register first so the server device id + refresh listener are live.
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');
    authService.registerDeviceInBackground();
    await flush();
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    mockMutate.mockClear();
    mockUnsubscribe.mockClear(); // count only logout's unsubscribe

    await authService.logout();

    // Device soft-deleted server-side (schema's replacement for deleteDevice).
    expect(updateCallsWith('delete')).toContainEqual(
      expect.objectContaining({ id: 'srv-1', delete: true }),
    );
    // Refresh listener unsubscribed and the session-scoped store state reset.
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockStoreState.resetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
  });

  it('completes local teardown even when deregistration rejects', async () => {
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');
    authService.registerDeviceInBackground();
    await flush();

    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    mockUnsubscribe.mockClear(); // count only logout's unsubscribe
    // The deregister (updateDevice delete) rejects.
    mockMutate.mockImplementation(({ variables }) => {
      const input = (variables?.input ?? {}) as Record<string, unknown>;
      if ('delete' in input) return Promise.reject(new Error('offline'));
      return Promise.resolve({ data: {} });
    });

    await expect(authService.logout()).resolves.toBeUndefined();

    // Local teardown still ran despite the network failure. The auth branch
    // of resetStore is what clears the session-scoped state a shared device
    // would otherwise hand to the next person.
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockStoreState.resetStore).toHaveBeenCalledTimes(1);
    expect(mockStoreState.resetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
  });
});
