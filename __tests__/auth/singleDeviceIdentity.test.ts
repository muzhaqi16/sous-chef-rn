// One device identity, not one per feature: the header, the socket, device
// registration and the device credential all present the same value. Two of
// them diverging is invisible to typecheck and to every other suite — each one
// keeps passing against its own id.

const mockMutate = jest.fn().mockResolvedValue({ data: {} });
const mockQuery = jest.fn().mockResolvedValue({ data: {} });
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

jest.mock('#/services/auth/deviceId');

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

jest.mock('#native/storage/keychain', () => ({
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

jest.mock('#/hooks/settings/useFeatureHint', () => ({
  incrementLoginCount: jest.fn(),
  resetAllFeatureHints: jest.fn(),
}));

import { registerApolloClient } from '#/apollo/clientRegistry';
import type { ApolloClient } from '@apollo/client';
import { biometricService } from '#/services/biometric/deviceCredential';
import { MOCK_DEVICE_ID as DEVICE_ID } from '#/services/auth/__mocks__/deviceId';
import { LoginDocument } from '#operations/auth/auth.generated';
import { print } from 'graphql';

// The client the code under test reads from the registry.
registerApolloClient({
  mutate: (...args: unknown[]) => mockMutate(...args),
  query: (...args: unknown[]) => mockQuery(...args),
} as unknown as ApolloClient);

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
    await biometricService.enrolDeviceCredential('chef@example.com');

    expect(inputWith('deviceId')).toEqual(
      expect.objectContaining({ deviceId: DEVICE_ID }),
    );
  });

  it('exchanging a device credential presents the same device', async () => {
    await biometricService.signInWithDeviceCredential('chef@example.com');

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

    await biometricService.revokeDeviceCredentialForThisDevice();

    expect(inputWith('id')).toEqual(expect.objectContaining({ id: 'mine' }));
  });
});

describe('the sign-in input carries no device field', () => {
  it('travels in the header only', () => {
    expect(print(LoginDocument)).not.toMatch(/deviceId/);
  });
});
