// Biometric credentials must NOT survive a sign-out.
//
// This suite asserted the opposite. The reasoning behind that was recorded as
// "reading the slot still costs a successful biometric prompt from that
// account's owner" — and it does not hold. The credential slot is
// `ACCESS_CONTROL.BIOMETRY_ANY` (`src/storage/keychain.ts`), which ANY biometric
// enrolled on the device satisfies, and typically the device passcode as well;
// the two slots the login screen reads to decide whether to OFFER the button
// (`indicatorServiceFor`, `LAST_BIOMETRIC_EMAIL_KEY`) carry no access control at
// all. On a shared device that produced: user A signs out, user B launches, the
// biometric button appears for A's address, and B's own finger unlocks A's
// stored password and signs in as A.
//
// The convenience this costs is real, and was the reason for the old default:
// biometric login exists to get the user back in after a sign-out, and clearing
// the slot means `LoginScreen` shows no biometric button until the account
// enrols again. That trade is now made explicitly — a caller that wants the old
// behaviour passes `keepBiometricCredentials: true` — instead of every sign-out
// leaving a password behind for whoever picks the device up next.
//
// Nothing caught the original: `sessionEndLeavesNoData` classifies persisted
// STORE keys on purpose, and the keychain is not in its inventory.

const mockMutate = jest.fn();
const mockQuery = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: {
    mutate: (...args: unknown[]) => mockMutate(...args),
    query: (...args: unknown[]) => mockQuery(...args),
  },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockResetStore = jest.fn().mockResolvedValue(undefined);
const mockSetNavigationState = jest.fn();
const mockStoreState: Record<string, unknown> = {
  user: { id: 'u1', email: 'chef@example.com' },
  isOnline: true,
  biometricRetryAt: 0,
  biometricAttempts: 0,
  registerBiometricRefusal: jest.fn(),
  setHasStoredCredentials: jest.fn(),
  clearBiometricBackoff: jest.fn(),
  resetStore: (...a: unknown[]) => mockResetStore(...a),
  setNavigationState: (...a: unknown[]) => mockSetNavigationState(...a),
  setAuthIsLoading: jest.fn(),
  setAuthIsLoadingCredentials: jest.fn(),
  getUserNavigationState: jest.fn().mockReturnValue({}),
  setUserNavigationState: jest.fn(),
};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
}));

const mockToastError = jest.fn();
const mockHasCredentials = jest.fn().mockResolvedValue(true);
jest.mock('#/services/toastService', () => ({
  toastService: { error: (...args: unknown[]) => mockToastError(...args) },
}));

jest.mock('#/apollo/logoutCleanup', () => ({
  LogoutCleanup: {
    performLogoutCleanup: jest.fn().mockResolvedValue(undefined),
    completeLogout: jest.fn(),
  },
}));

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: { onLogout: jest.fn(), onUserChange: jest.fn() },
}));

jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: { getCurrentUserId: jest.fn(), getPendingCount: () => 0 },
}));

const mockClearCredentials = jest.fn().mockResolvedValue(undefined);
jest.mock('#/storage/deviceId');
import { MOCK_DEVICE_ID } from '#/storage/__mocks__/deviceId';
import { ensureDeviceId } from '#/storage/deviceId';

jest.mock('#/storage/keychain', () => ({
  clearCredentials: (...a: unknown[]) => mockClearCredentials(...a),
  // The keychain's own shape; `dc1:` marks a slot holding a device credential
  // rather than a password. Without a loadable slot the exchange is never
  // reached and every case below passes without asserting anything.
  loadCredentials: jest.fn().mockResolvedValue({
    username: 'chef@example.com',
    password: 'dc1:secret',
  }),
  saveCredentials: jest.fn(),
  hasCredentials: (...a: unknown[]) => mockHasCredentials(...a),
  getBiometricCapability: jest
    .fn()
    .mockResolvedValue({ isAvailable: true, biometryType: 'Fingerprint' }),
  getLastBiometricEmail: jest.fn().mockResolvedValue('chef@example.com'),
  clearTempRegistrationPassword: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('#/services/push/pushTokenProvider', () => ({
  acquirePushToken: jest.fn().mockResolvedValue(null),
  getPushTokenProvider: () => ({ getToken: jest.fn() }),
  onPushTokenRefresh: () => jest.fn(),
}));

jest.mock('#/hooks/useFeatureHint', () => ({
  incrementLoginCount: jest.fn(),
  resetAllFeatureHints: jest.fn(),
}));

import { logger } from '#/utils/environment';
import { authService } from '#/services/authService';

describe('logout and biometric credentials', () => {
  beforeEach(() => {
    mockStoreState.biometricRetryAt = 0;
    mockHasCredentials.mockResolvedValue(true);
    mockClearCredentials.mockClear();
    // Call records do not survive into the next case: several assertions here
    // read "was this called at all", which a sibling's call would answer for.
    mockQuery.mockClear();
    mockMutate.mockClear();
    mockMutate.mockResolvedValue({ data: {} });
    // The lookup that finds THIS device's credential so it can be revoked.
    mockQuery.mockResolvedValue({
      data: {
        deviceCredentials: [
          {
            id: 'dc-1',
            deviceId: MOCK_DEVICE_ID,
            __typename: 'DeviceCredential',
          },
        ],
      },
    });
  });

  it('clears the stored credentials on an ordinary sign-out', async () => {
    await authService.logout();

    // The shared-device case: nothing of the previous account may be left
    // unlockable by the next person to pick the phone up.
    expect(mockClearCredentials).toHaveBeenCalledWith('chef@example.com');
  });

  it('keeps them only when the caller opts in', async () => {
    await authService.logout({ keepBiometricCredentials: true });

    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('still signs the user out of the session itself', async () => {
    await authService.logout();

    expect(mockResetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
    expect(mockSetNavigationState).toHaveBeenCalledWith('auth');
  });

  it('clears them when the account itself is going away', async () => {
    // Account deletion passes nothing now — the default already clears.
    await authService.logout();

    expect(mockClearCredentials).toHaveBeenCalledWith('chef@example.com');
  });

  // The asymmetry, and getting it backwards is the failure mode: revoking on
  // the sign-out that KEEPS the slot would leave a credential the exchange
  // refuses, which is the opposite of what keeping it is for.
  it('revokes server-side only when it also drops the local slot', async () => {
    await authService.logout();
    const revokedOnDrop = mockMutate.mock.calls.length;

    mockMutate.mockClear();
    await authService.logout({ keepBiometricCredentials: true });

    expect(revokedOnDrop).toBeGreaterThan(0);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // `DeviceCredential.deviceId` is non-null, so a null identity matches no
  // credential. Both callers destroy the only local handle to it immediately
  // after, so a revoke that resolves without issuing one leaves it live.
  it('says so when it cannot revoke, rather than resolving as though it had', async () => {
    (ensureDeviceId as jest.Mock).mockResolvedValueOnce(null);

    const revoked = await authService.revokeDeviceCredentialForThisDevice();

    expect(revoked).toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // The sign-out's own cleanup has to reach the server: `authLink` refuses
  // everything once `isLoggingOut` is set, and this revoke needs two sequential
  // round trips, so without the opt-in a slow link cancels it.
  it('opts its round trips out of the logout refusal', async () => {
    await authService.revokeDeviceCredentialForThisDevice();

    // `toEqual` drops undefined entries, so the opt-in is read as a boolean
    // per call — an absent context has to be visible as `false`.
    const optedIn = [
      ...mockQuery.mock.calls.map(([options]) => ['query', options]),
      ...mockMutate.mock.calls.map(([options]) => ['mutate', options]),
    ].map(
      ([kind, options]) =>
        `${kind}:${
          (options as { context?: { allowDuringLogout?: boolean } })?.context
            ?.allowDuringLogout === true
        }`,
    );

    expect(optedIn.length).toBeGreaterThan(1);
    expect(optedIn.filter(entry => entry.endsWith(':false'))).toStrictEqual([]);
  });

  // `RevokeDeviceCredentialResult` is a union and `errorPolicy: 'all'` resolves
  // a refusal as data, so an unread result reports the credential dead when it
  // is still exchangeable.
  it('reports a refused revoke as a failure rather than a success', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        revokeDeviceCredential: {
          __typename: 'ForbiddenError',
          code: 'FORBIDDEN',
          message: 'nope',
        },
      },
    });

    expect(await authService.revokeDeviceCredentialForThisDevice()).toBe(false);
  });

  it('treats a device with no credential of its own as nothing to revoke', async () => {
    mockQuery.mockResolvedValueOnce({ data: { deviceCredentials: [] } });

    expect(await authService.revokeDeviceCredentialForThisDevice()).toBe(true);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  // A tap that ends with the spinner stopping and nothing on screen reads as a
  // broken button. Every outcome says what happened.
  it('says why when the exchange cannot even be attempted', async () => {
    (ensureDeviceId as jest.Mock).mockResolvedValueOnce(null);

    expect(
      await authService.signInWithDeviceCredential('chef@example.com'),
    ).toBe(false);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining("isn't available on this device"),
    );
  });

  // Each attempt spends one of the server's per-device budget, and the slot
  // survives a refusal — so the button is offered again straight away.
  it('holds the next attempt off after a refusal, rather than re-spending', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        exchangeDeviceCredential: {
          __typename: 'AuthenticationError',
          code: 'AUTH_CREDENTIALS_INVALID',
          message: 'Invalid credentials',
        },
      },
    });
    await authService.signInWithDeviceCredential('chef@example.com');
    expect(mockStoreState.registerBiometricRefusal).toHaveBeenCalled();

    mockStoreState.biometricRetryAt = Date.now() + 30_000;
    mockMutate.mockClear();

    expect(
      await authService.signInWithDeviceCredential('chef@example.com'),
    ).toBe(false);
    expect(mockMutate).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('Too many attempts'),
    );
  });

  // The login screen renders the biometric button from `hasStoredCredentials`,
  // which no clear path writes — so a slot that has just been dropped keeps
  // offering a sign-in that can never work, and every tap is a dead end.
  it('takes the affordance down when the slot is empty, and says why', async () => {
    mockHasCredentials.mockResolvedValueOnce(false);

    expect(
      await authService.signInWithDeviceCredential('chef@example.com'),
    ).toBe(false);

    expect(mockStoreState.setHasStoredCredentials).toHaveBeenCalledWith(false);
    expect(mockToastError).toHaveBeenCalledWith(
      expect.stringContaining('needs setting up again'),
    );
  });

  it('takes it down when the server calls the credential dead', async () => {
    mockMutate.mockResolvedValueOnce({
      data: {
        exchangeDeviceCredential: {
          __typename: 'AuthenticationError',
          code: 'AUTH_DEVICE_CREDENTIAL_INVALID',
          message: 'gone',
        },
      },
    });

    await authService.signInWithDeviceCredential('chef@example.com');

    expect(mockClearCredentials).toHaveBeenCalledWith('chef@example.com');
    expect(mockStoreState.setHasStoredCredentials).toHaveBeenCalledWith(false);
  });

  it('reports a keychain delete that did not succeed', async () => {
    // A failed delete leaves the previous user's credential on the device. It
    // must not be indistinguishable from success — the boolean was discarded.
    mockClearCredentials.mockRejectedValueOnce(new Error('keychain locked'));

    await authService.logout();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('could not be removed'),
    );
  });
  /**
   * The other half of the same rule, from the opposite direction: a failure
   * that does NOT establish the credentials are dead must leave them alone.
   *
   * `autoLogin` cleared on any `result.error` and again in its catch, so a
   * single network blip on launch silently un-enrolled the device — the next
   * launch offered no biometric button, with nothing said. The payload branch
   * beside it already got this right via `isDeadCredentialCode`; these two did
   * not.
   */
  it('keeps stored credentials when auto-login fails on transport', async () => {
    mockClearCredentials.mockClear();
    mockMutate.mockRejectedValueOnce(new Error('Network request failed'));

    await authService.autoLogin();

    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('keeps them when auto-login resolves with a transport error', async () => {
    mockClearCredentials.mockClear();
    mockMutate.mockResolvedValueOnce({
      data: { login: null },
      error: new Error('Network request failed'),
    });

    await authService.autoLogin();

    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  /**
   * `exchangeDeviceCredential` names AUTH_DEVICE_CREDENTIAL_INVALID as its one
   * clear-the-slot signal, so this code is not proof the stored secret is dead.
   */
  it('keeps them when the exchange is refused as credentials-invalid', async () => {
    mockClearCredentials.mockClear();
    mockMutate.mockResolvedValueOnce({
      data: {
        exchangeDeviceCredential: {
          __typename: 'AuthenticationError',
          code: 'AUTH_CREDENTIALS_INVALID',
          message: 'Invalid credentials',
        },
      },
    });

    await authService.autoLogin();

    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('keeps them when the exchange is rate limited', async () => {
    mockClearCredentials.mockClear();
    mockMutate.mockResolvedValueOnce({
      data: {
        exchangeDeviceCredential: {
          __typename: 'ValidationError',
          code: 'OPERATION_RATE_LIMITED',
          message: 'Too many attempts',
        },
      },
    });

    await authService.autoLogin();

    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('drops them when the exchange says the credential itself is dead', async () => {
    mockClearCredentials.mockClear();
    mockMutate.mockResolvedValueOnce({
      data: {
        exchangeDeviceCredential: {
          __typename: 'AuthenticationError',
          code: 'AUTH_DEVICE_CREDENTIAL_INVALID',
          message: 'Credential is not usable',
        },
      },
    });

    await authService.autoLogin();

    expect(mockClearCredentials).toHaveBeenCalled();
  });
});
