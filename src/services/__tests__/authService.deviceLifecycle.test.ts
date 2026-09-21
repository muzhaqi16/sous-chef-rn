// Device-lifecycle behaviors of authService:
//  - P2-13: the getToken-timeout dead window — a push token that materializes
//    after acquirePushToken timed out (null) but before the refresh listener
//    subscribed is re-checked after subscribe and pushed to the server.
//  - A session end writes nothing to the device row: the server pushes only to
//    a live session bound to the device, so the refresh-token revoke ends
//    delivery. It unsubscribes the rotation listener and resets local state.
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
  restorePersistedCache: jest.fn(),
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
const mockOnRefresh = jest.fn<
  typeof mockUnsubscribe,
  [((token: string) => void)?]
>(() => mockUnsubscribe);
jest.mock('#/services/push/pushTokenProvider', () => ({
  acquirePushToken: () => mockAcquireToken(),
  getPushTokenProvider: () => ({ getToken: () => mockGetToken() }),
  onPushTokenRefresh: (listener: (token: string) => void) =>
    mockOnRefresh(listener),
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
  });
});

describe('revoking this device’s credential', () => {
  // Restored here, not after the assertions, which a failing one skips.
  afterEach(() => {
    Object.assign(mockStoreState, { isOnline: true, apiReachable: null });
  });

  const listed = {
    data: {
      deviceCredentials: [
        {
          __typename: 'DeviceCredential',
          id: 'dc-1',
          deviceId: MOCK_DEVICE_ID,
        },
      ],
    },
  };

  it('is sent when the API answers although the network flag reads offline', async () => {
    Object.assign(mockStoreState, { isOnline: false, apiReachable: true });
    mockQuery.mockResolvedValueOnce(listed);
    mockMutate.mockResolvedValueOnce({
      data: {
        revokeDeviceCredential: {
          __typename: 'RevokeDeviceCredentialPayload',
        },
      },
    });

    const revoked = await authService.revokeDeviceCredentialForThisDevice();

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ variables: { input: { id: 'dc-1' } } }),
    );
    expect(revoked).toBe(true);
  });

  it('is reported as not done when the listing fails', async () => {
    mockQuery.mockResolvedValueOnce({
      data: undefined,
      error: new Error('listing failed'),
    });

    const revoked = await authService.revokeDeviceCredentialForThisDevice();

    expect(revoked).toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
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

// `endSession` and `logout` both run the teardown. Neither touches the push
// registration: signing back in resumes delivery without re-registering, and a
// write here would need the credential the session end is discarding.
describe('a session end leaves the push registration to the server', () => {
  const teardown = () =>
    require('#store/sessionTeardown').runSessionTeardown() as Promise<void>;

  it('sends no device update from the teardown', async () => {
    authService.registerDeviceInBackground();
    await flush();
    mockMutate.mockClear();

    await teardown();
    await flush();

    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('removes the retired device-row key', async () => {
    const { clearRetiredDeviceRow } = require('#/storage/deviceId');

    await teardown();

    expect(clearRetiredDeviceRow).toHaveBeenCalled();
  });

  it('cannot skip the rest of the teardown', async () => {
    const { registerSessionTeardown } = require('#store/sessionTeardown');
    const later = jest.fn();
    registerSessionTeardown('after-device-push-token', later);

    await teardown();

    expect(later).toHaveBeenCalledTimes(1);
  });
});

describe('logout — push/notification teardown', () => {
  it('unsubscribes the rotation listener and resets the session state', async () => {
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');
    authService.registerDeviceInBackground();
    await flush();
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    mockMutate.mockClear();
    mockUnsubscribe.mockClear(); // count only logout's unsubscribe

    await authService.logout({ keepBiometricCredentials: true });

    // Neither a clear nor a delete: the row carries the device credential
    // biometric sign-in exchanges after a deliberate sign-out.
    expect(updateCallsWith('clearPushToken')).toEqual([]);
    expect(updateCallsWith('delete')).toEqual([]);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockStoreState.resetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
  });
});

describe('a rotated push token', () => {
  it('is not sent when blank, which the server would store as no token', async () => {
    const rotationListeners: ((token: string) => void)[] = [];
    mockOnRefresh.mockImplementationOnce(
      (listener?: (token: string) => void) => {
        if (listener) rotationListeners.push(listener);
        return mockUnsubscribe;
      },
    );
    mockAcquireToken.mockResolvedValueOnce('apns-1');
    mockGetToken.mockResolvedValueOnce('apns-1');
    authService.registerDeviceInBackground();
    await flush();
    mockMutate.mockClear();

    const [listener] = rotationListeners;
    listener?.('');
    listener?.('apns-2');
    await flush();

    expect(updateCallsWith('pushToken')).toEqual([
      { id: 'srv-1', pushToken: 'apns-2' },
    ]);
  });
});
