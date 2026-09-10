// One device identity, not one per feature: the header, the socket, device
// registration and the device credential all present the same value. Two of
// them diverging is invisible to typecheck and to every other suite — each one
// keeps passing against its own id.
//
// The STRUCTURAL half of that rule — that no other module mints or persists an
// identity — is the `device-identity` concern in
// `scripts/check-canonical-mechanisms.mjs`, which derives its file set from the
// tree and can prove it still fails. What is left here is behavioural.

const mockMutate = jest.fn().mockResolvedValue({ data: {} });
const mockQuery = jest.fn().mockResolvedValue({ data: {} });
jest.mock('#/apollo/client', () => ({
  client: {
    mutate: (...args: unknown[]) => mockMutate(...args),
    query: (...args: unknown[]) => mockQuery(...args),
  },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

jest.mock('#/storage/deviceId');

const mockStoreState: Record<string, unknown> = {
  isOnline: true,
  user: { id: 'u1', email: 'chef@example.com' },
  resetStore: jest.fn().mockResolvedValue(undefined),
  setAuthIsLoading: jest.fn(),
  setAuthIsLoadingCredentials: jest.fn(),
  setNavigationState: jest.fn(),
  getUserNavigationState: jest.fn().mockReturnValue({}),
  setUserNavigationState: jest.fn(),
};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
}));

jest.mock('#/storage/keychain', () => ({
  clearCredentials: jest.fn().mockResolvedValue(undefined),
  loadCredentials: jest.fn().mockResolvedValue({
    username: 'chef@example.com',
    password: 'dc1:secret',
  }),
  saveCredentials: jest.fn().mockResolvedValue(true),
  hasCredentials: jest.fn().mockResolvedValue(true),
  getStoredAccounts: jest.fn().mockResolvedValue([]),
  getBiometricCapability: jest
    .fn()
    .mockResolvedValue({ isAvailable: true, biometryType: 'Fingerprint' }),
  getLastBiometricEmail: jest.fn().mockResolvedValue('chef@example.com'),
  clearTempRegistrationPassword: jest.fn().mockResolvedValue(undefined),
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

jest.mock('#/services/push/pushTokenProvider', () => ({
  acquirePushToken: jest.fn().mockResolvedValue(null),
  getPushTokenProvider: () => ({ getToken: jest.fn() }),
  onPushTokenRefresh: () => jest.fn(),
}));

jest.mock('#/hooks/useFeatureHint', () => ({
  incrementLoginCount: jest.fn(),
  resetAllFeatureHints: jest.fn(),
}));

import { authService } from '#/services/authService';
import { MOCK_DEVICE_ID as DEVICE_ID } from '#/storage/__mocks__/deviceId';
import { LoginDocument } from '#operations/auth/auth.generated';
import { print } from 'graphql';

/** Variables of the one mutate call whose input carries `key`. */
const inputWith = (key: string) =>
  mockMutate.mock.calls
    .map(([opts]) => opts?.variables?.input)
    .find(input => !!input && key in input);

beforeEach(() => {
  mockMutate.mockClear();
  mockQuery.mockClear();
  mockMutate.mockResolvedValue({ data: {} });
});

describe('every identity surface presents one value', () => {
  it('issuing a device credential binds it to the same device', async () => {
    await authService.enrolDeviceCredential('chef@example.com');

    expect(inputWith('deviceId')).toEqual(
      expect.objectContaining({ deviceId: DEVICE_ID }),
    );
  });

  it('exchanging a device credential presents the same device', async () => {
    await authService.signInWithDeviceCredential('chef@example.com');

    expect(inputWith('credential')).toEqual(
      expect.objectContaining({ deviceId: DEVICE_ID }),
    );
  });

  it('revoking finds this device by the same value', async () => {
    mockQuery.mockResolvedValueOnce({
      data: {
        deviceCredentials: [
          {
            __typename: 'DeviceCredential',
            id: 'other',
            deviceId: 'device_someone_else',
          },
          { __typename: 'DeviceCredential', id: 'mine', deviceId: DEVICE_ID },
        ],
      },
    });

    await authService.revokeDeviceCredentialForThisDevice();

    expect(inputWith('id')).toEqual(expect.objectContaining({ id: 'mine' }));
  });

});

describe('the sign-in input carries no device field', () => {
  it('travels in the header only', () => {
    expect(print(LoginDocument)).not.toMatch(/deviceId/);
  });
});
