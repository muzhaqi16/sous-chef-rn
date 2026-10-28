// Device-lifecycle behaviors of device registration and the sign-out:
//  - P2-13: the getToken-timeout dead window — a push token that materializes
//    after acquirePushToken timed out (null) but before the refresh listener
//    subscribed is re-checked after subscribe and pushed to the server.
//  - A session end writes nothing to the device row: the server pushes only to
//    a live session bound to the device, so the refresh-token revoke ends
//    delivery. It unsubscribes the rotation listener and resets local state.
//
// Both read the registered Apollo client and module boundaries, so each
// dependency is mocked at its module edge (the pattern in
// authService.register.test.ts).

const mockMutate = jest.fn();
const mockQuery = jest.fn().mockResolvedValue({ data: {} });
const mockCache = { evict: jest.fn(), gc: jest.fn() };
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockStoreState: Record<string, unknown> = {};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
}));

const mockCollect = jest.fn().mockResolvedValue({ deviceId: 'local-1' });
jest.mock('#native/deviceInfo', () => ({
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

jest.mock('#/services/auth/deviceId');

jest.mock('#native/storage/keychain', () => ({
  removeBiometricCredentials: jest.fn().mockResolvedValue(true),
}));

import type { RootState } from '#store';
import { createResetManager } from '#store/resetManager';
import { registerApolloClient } from '#/apollo/clientRegistry';
import type { ApolloClient } from '@apollo/client';
import { authService } from '#/services/authService';
import { biometricService } from '#/services/biometric/deviceCredential';
import { registerDeviceInBackground } from '#/services/device/deviceRegistration';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';
import { logger } from '#/utils/environment';
import {
  clearRegisteredLocale,
  ensureDeviceId,
  recordRegisteredLocale,
} from '#/services/auth/deviceId';
import { MOCK_DEVICE_ID } from '#/services/auth/__mocks__/deviceId';
import { GetUserSettingsDocument } from '#operations/auth/user.generated';

// A sign-out revokes and drops the slot through the step the app registers.
registerMobileSessionHost();

// The client the code under test reads from the registry.
registerApolloClient({
  mutate: (...args: unknown[]) => mockMutate(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  // A getter: the factory runs before `mockCache` is initialised.
  get cache() {
    return mockCache;
  },
} as unknown as ApolloClient);

/** Route client.mutate: RegisterDevice by the `deviceId` it carries. */
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
  (recordRegisteredLocale as jest.Mock).mockReturnValue(false);
  mockCollect.mockResolvedValue({ deviceId: 'local-1' });
  routeMutate();
  Object.assign(mockStoreState, {
    isOnline: true,
    user: null,
    // Registration belongs to a session; the cases below run inside one.
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    clearAuth: jest.fn(),
    // The real session end over this fake store, so a sign-out runs the
    // teardown and the reset it runs in the app.
    endSession: (...args: Parameters<RootState['endSession']>) =>
      createResetManager(
        partial => Object.assign(mockStoreState, partial),
        () => mockStoreState as unknown as RootState,
      ).endSession(...args),
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

    registerDeviceInBackground();
    await flush();

    expect(registerCall()).toMatchObject({ pushToken: 'apns-1' });
  });

  it('clears the stored token when permission is not granted', async () => {
    mockPermissionCheck.mockResolvedValueOnce('blocked');

    registerDeviceInBackground();
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

    registerDeviceInBackground();
    await flush();

    expect(registerCall()?.pushToken).toBeUndefined();
  });
});

// The server reads a "Device default" user's unit system from the registered
// locale, so a picker asked before registration, or under another locale,
// answered in the wrong system.
describe('registerDeviceInBackground — the unit pickers', () => {
  const droppedPickers = () =>
    mockCache.evict.mock.calls.map(([options]) => options?.fieldName);

  it('drops them once a registration lands a locale new to this session', async () => {
    mockCollect.mockResolvedValueOnce({
      deviceId: 'local-1',
      language: 'en-US',
    });
    (recordRegisteredLocale as jest.Mock).mockReturnValueOnce(true);

    registerDeviceInBackground();
    await flush();

    expect(recordRegisteredLocale).toHaveBeenCalledWith('en-US');
    expect(droppedPickers()).toEqual([
      'consumptionUnitsForPantryItem',
      'restockUnitsForPantryItem',
    ]);
  });

  // Over the cached settings, never by evicting a field of them: a settings
  // read left incomplete falls back to metric until the answer lands.
  it("re-reads what the new locale means for the device's unit system", async () => {
    (recordRegisteredLocale as jest.Mock).mockReturnValueOnce(true);

    registerDeviceInBackground();
    await flush();

    expect(mockQuery).toHaveBeenCalledWith({
      query: GetUserSettingsDocument,
      fetchPolicy: 'network-only',
    });
    expect(droppedPickers()).not.toContain('deviceUnitSystem');
  });

  it('keeps them when the locale is the one already registered', async () => {
    registerDeviceInBackground();
    await flush();

    expect(recordRegisteredLocale).toHaveBeenCalled();
    expect(mockCache.evict).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('records nothing when the registration did not land', async () => {
    mockMutate.mockResolvedValue({
      data: {
        registerDevice: { __typename: 'ValidationError', message: 'no' },
      },
    });

    registerDeviceInBackground();
    await flush();

    expect(recordRegisteredLocale).not.toHaveBeenCalled();
  });

  // Null, not left out: the server keeps a stored locale for a missing field,
  // so an en-US an earlier build guessed would never clear.
  it("clears the stored locale when the device's cannot be read", async () => {
    mockCollect.mockResolvedValueOnce({ deviceId: 'local-1', language: null });

    registerDeviceInBackground();
    await flush();

    const location = registerCall()?.location;

    expect(location).toHaveProperty('language', null);
    // Nor a country it never read.
    expect(location).not.toHaveProperty('ipCountry');
  });
});

// The collection is ~34 native round trips, one of them instantiating a WebView
// on Android. Running it for an identity that is not there, three times behind
// an exponential backoff, spends all of that on a guaranteed refusal.
describe('registerDeviceInBackground — no identity to register under', () => {
  it('collects nothing and does not retry', async () => {
    (ensureDeviceId as jest.Mock).mockResolvedValue(null);

    registerDeviceInBackground();
    await flush();

    expect(mockCollect).not.toHaveBeenCalled();
    expect(ensureDeviceId).toHaveBeenCalledTimes(1);
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

// A restored session can turn out to be expired: the sign-out then lands while
// the registration it started is still retrying. Each retry would go out with no
// credential and set off a refresh that has no token to present.
describe('registerDeviceInBackground — a session that ends', () => {
  const refuse = () =>
    mockMutate.mockResolvedValue({
      data: {
        registerDevice: {
          __typename: 'ValidationError',
          code: 'VALIDATION_FAILED',
          message: 'refused',
        },
      },
    });
  const registerCalls = () =>
    mockMutate.mock.calls.filter(
      ([opts]) => 'deviceId' in (opts?.variables?.input ?? {}),
    ).length;

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stops retrying once the session ends', async () => {
    jest.useFakeTimers();
    refuse();

    registerDeviceInBackground();
    await flush();
    expect(registerCalls()).toBe(1);

    await require('#store/sessionTeardown').runSessionTeardown();
    await jest.advanceTimersByTimeAsync(10_000);
    await flush();

    expect(registerCalls()).toBe(1);
  });

  it('does not start once the session has already ended', async () => {
    Object.assign(mockStoreState, { accessToken: null, refreshToken: null });

    registerDeviceInBackground();
    await flush();

    expect(mockCollect).not.toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalledWith(
      'Background device registration failed',
    );
  });

  it('still retries a refusal while the session lasts', async () => {
    jest.useFakeTimers();
    refuse();

    registerDeviceInBackground();
    await flush();
    await jest.advanceTimersByTimeAsync(2_000);
    await flush();

    expect(registerCalls()).toBe(2);
  });
});

describe('registerDeviceInBackground — getToken dead-window re-check (P2-13)', () => {
  it('sends a token that materialized after the acquire timeout', async () => {
    // acquirePushToken timed out (null); the token arrives before the re-check.
    mockAcquireToken.mockResolvedValueOnce(null);
    mockGetToken.mockResolvedValueOnce('apns-late');

    registerDeviceInBackground();
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

    registerDeviceInBackground();
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
    expect(mockStoreState.user).toBeNull();
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

    const revoked =
      await biometricService.revokeDeviceCredentialForThisDevice();

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

    const revoked =
      await biometricService.revokeDeviceCredentialForThisDevice();

    expect(revoked).toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
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

    registerDeviceInBackground();
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
    registerDeviceInBackground();
    await flush();
    mockMutate.mockClear();

    await teardown();
    await flush();

    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('forgets the registered locale, which the next account has not sent', async () => {
    await teardown();

    expect(clearRegisteredLocale).toHaveBeenCalled();
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
    registerDeviceInBackground();
    await flush();
    expect(mockOnRefresh).toHaveBeenCalledTimes(1);

    mockStoreState.user = { id: 'u1', email: 'u1@example.com' };
    mockMutate.mockClear();
    mockUnsubscribe.mockClear(); // count only logout's unsubscribe

    await authService.logout({ keepBiometricCredentials: true });

    // No clear: the row carries the device credential biometric sign-in
    // exchanges after a deliberate sign-out.
    expect(updateCallsWith('clearPushToken')).toEqual([]);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockStoreState.user).toBeNull();
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
    registerDeviceInBackground();
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
