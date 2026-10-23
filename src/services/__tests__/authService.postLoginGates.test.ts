// The gates `handleLogin` resolves after a SUCCESSFUL sign-in, through the
// steps the mobile app registers, and what `login` reports when it cannot open
// a session at all.
//
// The other authService suites drive refusals, so neither reaches this path.
// Both defects here are invisible from a refusal: the RememberMe gate offers
// biometric-protected storage to someone who refused biometrics, and `login`
// returns true without ever calling `handleLogin` when the masked read of the
// login payload comes back incomplete.

const mockMutate = jest.fn();
const mockQuery = jest.fn();
const mockReadFragment = jest.fn();
jest.mock('#/apollo/client', () => ({
  restorePersistedCache: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const navStates = new Map<string, Record<string, unknown>>();
const mockStore = {
  user: null as unknown,
  setAuth: jest.fn(),
  clearAuth: jest.fn(),
  setAuthIsLoading: jest.fn(),
  setAuthIsLoadingCredentials: jest.fn(),
  setRememberMe: jest.fn(),
  setNavigationState: jest.fn(),
  setPostLoginCredentials: jest.fn(),
  setShowBiometricSetup: jest.fn(),
  setHomeAndPantry: jest.fn(),
  setIsHomeSelectionReady: jest.fn(),
  setSelectedShoppingListId: jest.fn(),
  setPreferredCurrency: jest.fn(),
  updateUser: jest.fn(),
  clearBiometricBackoff: jest.fn(),
  registerBiometricRefusal: jest.fn(),
  setHasStoredCredentials: jest.fn(),
  getUserNavigationState: (id: string) => navStates.get(id),
  setUserNavigationState: jest.fn(),
};
jest.mock('#store', () => ({ useStore: { getState: () => mockStore } }));

const mockToastError = jest.mocked(toastService.error);

const mockGetBiometricCapability = jest.fn();
const mockHasCredentials = jest.fn();
jest.mock('#native/storage/keychain', () => ({
  getBiometricCapability: () => mockGetBiometricCapability(),
  hasCredentials: (...args: unknown[]) => mockHasCredentials(...args),
  getLastBiometricEmail: jest.fn(),
  clearCredentials: jest.fn(),
  loadCredentials: jest.fn(),
  saveCredentials: jest.fn(),
}));

const mockCheckStoredCredentials = jest.fn();
const mockRemoveCredentials = jest.fn();
jest.mock('#/services/biometric/credentials', () => ({
  checkStoredCredentials: (...args: unknown[]) =>
    mockCheckStoredCredentials(...args),
  getBiometricInfo: jest.fn(),
  loadStoredCredentials: jest.fn(),
  markDeviceCredential: jest.fn(),
  readDeviceCredential: jest.fn(),
  removeCredentials: (...args: unknown[]) => mockRemoveCredentials(...args),
  storeCredentials: jest.fn(),
}));

jest.mock('#/services/device/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('#/hooks/settings/useFeatureHint', () => ({
  incrementLoginCount: jest.fn(),
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
jest.mock('#/services/auth/deviceId');

import { registerApolloClient } from '#/apollo/clientRegistry';
import type { ApolloClient } from '@apollo/client';
import { toastService } from '#/services/toastService';
import { authService } from '#/services/authService';
import { registerMobileSessionHost } from '#/app/mobileSessionHost';
import { MOCK_DEVICE_ID } from '#/services/auth/__mocks__/deviceId';

registerMobileSessionHost();

// The client the code under test reads from the registry.
registerApolloClient({
  mutate: (...args: unknown[]) => mockMutate(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  cache: { readFragment: (...args: unknown[]) => mockReadFragment(...args) },
} as unknown as ApolloClient);

const INPUT = { email: 'ada@example.com', password: 'pw-12345' };
const USER_ID = 'u1';

const SUCCESS = {
  data: {
    login: {
      __typename: 'AuthPayload',
      accessToken: 'at',
      refreshToken: 'rt',
      user: { __typename: 'User', id: USER_ID },
    },
  },
};

/** What the masked read returns once the cache holds the whole fragment. */
const unmaskedUser = {
  __typename: 'User',
  id: USER_ID,
  email: INPUT.email,
  emailVerified: true,
  onBoarded: true,
  defaultHomeId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  navStates.clear();
  mockMutate.mockResolvedValue(SUCCESS);
  mockReadFragment.mockReturnValue(unmaskedUser);
  mockGetBiometricCapability.mockResolvedValue({ isAvailable: false });
  mockHasCredentials.mockResolvedValue(false);
  mockCheckStoredCredentials.mockResolvedValue(false);
  mockRemoveCredentials.mockResolvedValue(true);
});

describe('the RememberMe fallback', () => {
  it('is offered when the device cannot do biometrics at all', async () => {
    await authService.login(INPUT);

    expect(mockStore.setPostLoginCredentials).toHaveBeenCalledWith({
      email: INPUT.email,
    });
    expect(mockStore.setNavigationState).not.toHaveBeenCalledWith('main_app');
  });

  it('is NOT offered to someone who permanently declined biometrics', async () => {
    // The declined flag also makes the biometric gate decline to show, so
    // testing `!showBiometricGate` offers credential storage to exactly the
    // person who refused the slot it is stored in.
    navStates.set(USER_ID, { biometricDeclinedPermanently: true });
    mockGetBiometricCapability.mockResolvedValue({ isAvailable: true });

    await authService.login(INPUT);

    expect(mockStore.setPostLoginCredentials).not.toHaveBeenCalled();
    expect(mockStore.setNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('is NOT offered when biometrics are available and the gate takes over', async () => {
    mockGetBiometricCapability.mockResolvedValue({ isAvailable: true });

    await authService.login(INPUT);

    expect(mockStore.setNavigationState).toHaveBeenCalledWith(
      'biometric_setup',
    );
  });
});

describe('a login whose masked read comes back incomplete', () => {
  beforeEach(() => {
    mockReadFragment.mockReturnValue(null);
  });

  it('reports failure rather than success', async () => {
    const ok = await authService.login(INPUT);

    expect(ok).toBe(false);
  });

  it('opens no session and tells the user', async () => {
    await authService.login(INPUT);

    expect(mockStore.setAuth).not.toHaveBeenCalled();
    expect(mockStore.setNavigationState).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalled();
    expect(mockStore.setAuthIsLoading).toHaveBeenLastCalledWith(false);
  });
});

// A password change or reset revokes this device's credential server-side and
// tells no device, so the slot still reads as set up until something asks.
describe('a stored fingerprint sign-in, after a password sign-in', () => {
  const listed = (...deviceIds: string[]) => ({
    data: {
      deviceCredentials: deviceIds.map((deviceId, index) => ({
        __typename: 'DeviceCredential',
        id: `dc-${index}`,
        deviceId,
      })),
    },
  });

  beforeEach(() => {
    mockGetBiometricCapability.mockResolvedValue({ isAvailable: true });
    mockHasCredentials.mockResolvedValue(true);
  });

  it('is kept while the server lists it for this device', async () => {
    mockQuery.mockResolvedValue(listed('other-device', MOCK_DEVICE_ID));

    await authService.login(INPUT);

    // Asked with the sign-in's own token: the pair is not stored yet.
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        fetchPolicy: 'no-cache',
        context: { signInToken: 'at' },
      }),
    );
    expect(mockRemoveCredentials).not.toHaveBeenCalled();
    expect(mockStore.setNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('is removed and set up again once the server no longer lists it', async () => {
    mockQuery.mockResolvedValue(listed('other-device'));

    await authService.login(INPUT);

    expect(mockRemoveCredentials).toHaveBeenCalledWith(INPUT.email);
    expect(mockStore.setHasStoredCredentials).toHaveBeenCalledWith(false);
    expect(mockStore.setNavigationState).toHaveBeenCalledWith(
      'biometric_setup',
    );
  });

  it('is removed without a prompt for someone who declined biometrics', async () => {
    navStates.set(USER_ID, { biometricDeclinedPermanently: true });
    mockQuery.mockResolvedValue(listed());

    await authService.login(INPUT);

    expect(mockRemoveCredentials).toHaveBeenCalledWith(INPUT.email);
    expect(mockStore.setNavigationState).toHaveBeenCalledWith('main_app');
  });

  it('is kept when the server cannot be asked', async () => {
    // errorPolicy 'all': a failed read resolves with no data and the error.
    mockQuery.mockResolvedValue({
      data: undefined,
      error: new Error('Network request failed'),
    });

    await authService.login(INPUT);

    expect(mockRemoveCredentials).not.toHaveBeenCalled();
    expect(mockStore.setHasStoredCredentials).not.toHaveBeenCalledWith(false);
    expect(mockStore.setNavigationState).toHaveBeenCalledWith('main_app');
  });
});
