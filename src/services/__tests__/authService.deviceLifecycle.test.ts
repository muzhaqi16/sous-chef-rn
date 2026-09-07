// Device-lifecycle behaviors of authService:
//  - P2-13: the getToken-timeout dead window — a push token that materializes
//    after acquirePushToken timed out (null) but before the refresh listener
//    subscribed is re-checked after subscribe and pushed to the server.
//  - P2-11: logout tears down the prior user's push/notification state —
//    clears the device push token (updateDevice clearPushToken:true) while
//    leaving the device row intact, unsubscribes the refresh listener, and
//    resets notification state; a failure never blocks the local teardown.
//
// authService uses the singleton Apollo client and reads module boundaries, so
// each dependency is mocked at its module edge (the pattern in
// authService.register.test.ts).

const mockMutate = jest.fn();
const mockQuery = jest.fn().mockResolvedValue({ data: {} });
jest.mock('#/apollo/client', () => ({
  client: {
    mutate: (...args: unknown[]) => mockMutate(...args),
    query: (...args: unknown[]) => mockQuery(...args),
  },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStoreState: Record<string, unknown> = {};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
}));

const mockCollect = jest.fn().mockResolvedValue({ deviceId: 'local-1' });
jest.mock('#/utils/deviceInfo', () => ({
  collectDeviceInformation: () => mockCollect(),
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

jest.mock('#/storage/deviceId');

jest.mock('#/storage/keychain', () => ({
  removeBiometricCredentials: jest.fn().mockResolvedValue(true),
  clearTempRegistrationPassword: jest.fn().mockResolvedValue(undefined),
}));

import { authService } from '#/services/authService';
import { logger } from '#/utils/environment';
import {
  clearLegacyDeviceFingerprint,
  ensureDeviceId,
  readLegacyDeviceFingerprint,
} from '#/storage/deviceId';
import { MOCK_DEVICE_ID } from '#/storage/__mocks__/deviceId';

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
  // `clearAllMocks` clears calls, not implementations, so a case that stands the
  // identity down has to be undone here or it leaks into every case after it.
  (ensureDeviceId as jest.Mock).mockResolvedValue(MOCK_DEVICE_ID);
  (readLegacyDeviceFingerprint as jest.Mock).mockReturnValue(null);
  mockCollect.mockResolvedValue({ deviceId: 'local-1' });
  routeMutate();
  Object.assign(mockStoreState, {
    isOnline: true,
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

// The collection is ~34 native round trips, one of them instantiating a WebView
// on Android. Running it for an identity that is not there, three times behind
// an exponential backoff, spends all of that on a guaranteed refusal.
describe('registerDeviceInBackground — no identity to register under', () => {
  it('collects nothing and does not retry', async () => {
    (ensureDeviceId as jest.Mock).mockResolvedValue(null);

    authService.registerDeviceInBackground();
    await flush();

    expect(mockCollect).not.toHaveBeenCalled();
    expect(ensureDeviceId).toHaveBeenCalledTimes(1);
    expect(mockMutate).not.toHaveBeenCalled();
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

describe('logout — session teardown and pacing', () => {
  it('runs the session teardown, as every other path that ends a session does', async () => {
    const { registerSessionTeardown } = require('#store/sessionTeardown');
    const step = jest.fn();
    registerSessionTeardown('probe', step);

    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    await authService.logout();

    expect(step).toHaveBeenCalledTimes(1);
  });

  it('does not hold the sign-out behind a revoke while offline', async () => {
    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    mockStoreState.isOnline = false;
    mockQuery.mockClear();

    await authService.logout();

    // Nothing to revoke against, so the round trip is not attempted at all.
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockStoreState.resetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
    mockStoreState.isOnline = true;
  });
});

// `updateDevice` returns a union: ConflictError | ForbiddenError | NotFoundError
// | UpdateDevicePayload | ValidationError. A refusal RESOLVES, so a `.catch`
// never sees it and the token keeps delivering to a signed-out account.
// An install that registered under the previous identifier has a second server
// row. Its push token is live and no other client path can reach it, so it keeps
// delivering to whoever signed in on this device before the identifier changed.
describe('retiring the row a superseded identifier registered', () => {
  const LEGACY = 'android-oldfingerprint';

  const foundRow = (row: { id: string; deviceId: string } | null) =>
    mockQuery.mockResolvedValue({ data: { deviceByDeviceId: row } });

  it('does not look anything up on an install that has no legacy key', async () => {
    authService.registerDeviceInBackground();
    await flush();

    expect(mockQuery).not.toHaveBeenCalled();
    expect(updateCallsWith('delete')).toEqual([]);
  });

  it('soft-deletes the row and drops the key', async () => {
    (readLegacyDeviceFingerprint as jest.Mock).mockReturnValue(LEGACY);
    foundRow({ id: 'srv-old', deviceId: LEGACY });

    authService.registerDeviceInBackground();
    await flush();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { deviceId: LEGACY } }),
    );
    expect(updateCallsWith('delete')).toContainEqual(
      expect.objectContaining({ id: 'srv-old', delete: true }),
    );
    expect(clearLegacyDeviceFingerprint).toHaveBeenCalled();
  });

  it('treats a row the server no longer has as already retired', async () => {
    (readLegacyDeviceFingerprint as jest.Mock).mockReturnValue(LEGACY);
    foundRow(null);

    authService.registerDeviceInBackground();
    await flush();

    expect(updateCallsWith('delete')).toEqual([]);
    expect(clearLegacyDeviceFingerprint).toHaveBeenCalled();
  });

  it('keeps the key when the lookup fails, so a later launch retries', async () => {
    (readLegacyDeviceFingerprint as jest.Mock).mockReturnValue(LEGACY);
    mockQuery.mockRejectedValue(new Error('offline'));

    authService.registerDeviceInBackground();
    await flush();

    expect(clearLegacyDeviceFingerprint).not.toHaveBeenCalled();
  });

  it('keeps the key when the server refuses the retirement', async () => {
    (readLegacyDeviceFingerprint as jest.Mock).mockReturnValue(LEGACY);
    foundRow({ id: 'srv-old', deviceId: LEGACY });
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
            __typename: 'ForbiddenError',
            code: 'FORBIDDEN',
            message: 'no',
          },
        },
      });
    });

    authService.registerDeviceInBackground();
    await flush();

    expect(clearLegacyDeviceFingerprint).not.toHaveBeenCalled();
  });

  it('is not attempted when the registration itself did not land', async () => {
    (readLegacyDeviceFingerprint as jest.Mock).mockReturnValue(LEGACY);
    (ensureDeviceId as jest.Mock).mockResolvedValue(null);

    authService.registerDeviceInBackground();
    await flush();

    expect(mockQuery).not.toHaveBeenCalled();
    expect(clearLegacyDeviceFingerprint).not.toHaveBeenCalled();
  });
});

describe('a device update is judged by its result, not by not throwing', () => {
  const refuse = (typename: string, code: string) =>
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
          updateDevice: { __typename: typename, code, message: 'refused' },
        },
      });
    });

  it('does not report a refused push-token clear as a cleared token', async () => {
    authService.registerDeviceInBackground();
    await flush();
    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    refuse('ForbiddenError', 'FORBIDDEN');

    await authService.logout();
    await flush();

    expect(logger.info).not.toHaveBeenCalledWith(
      'Device push token cleared on session end',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Failed to clear the device push token on session end:',
      expect.objectContaining({ status: 'refused', code: 'FORBIDDEN' }),
    );
  });

  it('does not report a refused token rotation as delivered', async () => {
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-2');
    refuse('NotFoundError', 'RESOURCE_NOT_FOUND');

    authService.registerDeviceInBackground();
    await flush();

    expect(logger.info).not.toHaveBeenCalledWith(
      'Device push token updated after rotation',
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Failed to update rotated push token:',
      expect.objectContaining({ status: 'refused' }),
    );
  });
});

// `endSession` — the path an `account_inactive`, `refresh_token_dead` or
// `session_revoked` verdict takes — clears no push token of its own. It runs the
// teardown, so the clear belongs there rather than beside the deliberate
// sign-out; otherwise a server-ended session leaves a live delivery target on a
// device the next person signs in on.
describe('a server-ended session stops push delivery too', () => {
  const teardown = () =>
    require('#store/sessionTeardown').runSessionTeardown() as Promise<void>;

  it('clears the token from the teardown, not only from a deliberate sign-out', async () => {
    authService.registerDeviceInBackground();
    await flush();
    mockMutate.mockClear();

    await teardown();
    await flush();

    expect(updateCallsWith('clearPushToken')).toContainEqual(
      expect.objectContaining({ id: 'srv-1', clearPushToken: true }),
    );
  });

  it('resolves this device row when the session ends before registration', async () => {
    mockQuery.mockResolvedValue({
      data: { deviceByDeviceId: { id: 'srv-9', deviceId: MOCK_DEVICE_ID } },
    });

    await teardown();
    await flush();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { deviceId: MOCK_DEVICE_ID } }),
    );
    expect(updateCallsWith('clearPushToken')).toContainEqual(
      expect.objectContaining({ id: 'srv-9', clearPushToken: true }),
    );
  });

  it('cannot skip the rest of the teardown by failing', async () => {
    const { registerSessionTeardown } = require('#store/sessionTeardown');
    const later = jest.fn();
    registerSessionTeardown('after-device-push-token', later);
    mockQuery.mockRejectedValue(new Error('offline'));

    await teardown();
    await flush();

    expect(later).toHaveBeenCalledTimes(1);
  });

  it('does not spend a doomed round trip while offline', async () => {
    mockStoreState.isOnline = false;

    await teardown();
    await flush();

    expect(mockQuery).not.toHaveBeenCalled();
    expect(updateCallsWith('clearPushToken')).toEqual([]);
  });
});

describe('logout — push/notification teardown (P2-11)', () => {
  it('clears the push token, unsubscribes the listener, and resets notifications', async () => {
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

    // Push delivery suppressed server-side.
    expect(updateCallsWith('clearPushToken')).toContainEqual(
      expect.objectContaining({ id: 'srv-1', clearPushToken: true }),
    );
    // The device row survives: deleting it would revoke the device credential
    // biometric sign-in exchanges after a deliberate sign-out.
    expect(updateCallsWith('delete')).toEqual([]);
    // Refresh listener unsubscribed and the session-scoped store state reset.
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockStoreState.resetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
  });

  it('completes local teardown even when the push-token clear rejects', async () => {
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');
    authService.registerDeviceInBackground();
    await flush();

    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    mockUnsubscribe.mockClear(); // count only logout's unsubscribe
    // The push-token clear (updateDevice clearPushToken) rejects.
    mockMutate.mockImplementation(({ variables }) => {
      const input = (variables?.input ?? {}) as Record<string, unknown>;
      if ('clearPushToken' in input)
        return Promise.reject(new Error('offline'));
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
