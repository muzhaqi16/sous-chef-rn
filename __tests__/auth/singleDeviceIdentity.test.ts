// One device identity, not one per feature: the header, the socket, device
// registration and the device credential all present the same value. Two of
// them diverging is invisible to typecheck and to every other suite — each one
// keeps passing against its own id.

const DEVICE_ID = 'device_canonical';

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

jest.mock('#/storage/deviceId', () => ({
  getDeviceId: () => DEVICE_ID,
  initializeDeviceId: () => DEVICE_ID,
}));

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

import fs from 'fs';
import path from 'path';
import { authService } from '#/services/authService';
import { LoginDocument } from '#operations/auth/auth.generated';
import { print } from 'graphql';

const SRC = path.join(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

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
          { id: 'other', deviceId: 'device_someone_else' },
          { id: 'mine', deviceId: DEVICE_ID },
        ],
      },
    });

    await authService.revokeDeviceCredentialForThisDevice();

    expect(inputWith('id')).toEqual(expect.objectContaining({ id: 'mine' }));
  });

  // The three surfaces this suite cannot drive without standing up their own
  // transports. Each is asserted behaviourally in its own suite; here they are
  // held to the same SOURCE, which is what keeps those suites comparable.
  it.each([
    'apollo/links/authLink.ts',
    'apollo/links/wsLink.ts',
    'utils/deviceInfo.ts',
  ])('%s reads the canonical accessor', file => {
    expect(read(file)).toContain(
      "import { getDeviceId } from '#/storage/deviceId'",
    );
  });

  it('no module holds a second persisted identity', () => {
    expect(fs.existsSync(path.join(SRC, 'storage/deviceIdentity.ts'))).toBe(false);
  });
});

describe('the sign-in input carries no device field', () => {
  it('travels in the header only', () => {
    expect(print(LoginDocument)).not.toMatch(/deviceId/);
  });
});

describe('the value fits what the server accepts', () => {
  it('is at most 128 characters, past which the server reads it as absent', () => {
    const { getDeviceId } = jest.requireActual<
      typeof import('#/storage/deviceId')
    >('#/storage/deviceId');

    expect((getDeviceId() ?? '').length).toBeLessThanOrEqual(128);
  });
});
