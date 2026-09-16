// The gates `handleLogin` resolves after a SUCCESSFUL sign-in, and what `login`
// reports when it cannot open a session at all.
//
// The other authService suites drive refusals, so neither reaches this path.
// Both defects here are invisible from a refusal: the RememberMe gate offers
// biometric-protected storage to someone who refused biometrics, and `login`
// returns true without ever calling `handleLogin` when the masked read of the
// login payload comes back incomplete.

const mockMutate = jest.fn();
const mockReadFragment = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: {
    mutate: (...args: unknown[]) => mockMutate(...args),
    cache: { readFragment: (...args: unknown[]) => mockReadFragment(...args) },
  },
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
  clearBiometricBackoff: jest.fn(),
  registerBiometricRefusal: jest.fn(),
  setHasStoredCredentials: jest.fn(),
  getUserNavigationState: (id: string) => navStates.get(id),
  setUserNavigationState: jest.fn(),
};
jest.mock('#store', () => ({ useStore: { getState: () => mockStore } }));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: { error: (...args: unknown[]) => mockToastError(...args) },
}));

const mockGetBiometricCapability = jest.fn();
const mockHasCredentials = jest.fn();
jest.mock('#/storage/keychain', () => ({
  getBiometricCapability: () => mockGetBiometricCapability(),
  hasCredentials: (...args: unknown[]) => mockHasCredentials(...args),
  getLastBiometricEmail: jest.fn(),
  clearCredentials: jest.fn(),
  loadCredentials: jest.fn(),
  saveCredentials: jest.fn(),
  clearTempRegistrationPassword: jest.fn(),
}));

const mockCheckStoredCredentials = jest.fn();
jest.mock('#/services/auth/credentials', () => ({
  checkStoredCredentials: (...args: unknown[]) =>
    mockCheckStoredCredentials(...args),
  getBiometricInfo: jest.fn(),
  loadStoredCredentials: jest.fn(),
  markDeviceCredential: jest.fn(),
  readDeviceCredential: jest.fn(),
  removeCredentials: jest.fn(),
  storeCredentials: jest.fn(),
}));

jest.mock('#/services/auth/deviceRegistration', () => ({
  registerDeviceInBackground: jest.fn(),
}));
jest.mock('#/hooks/useFeatureHint', () => ({ incrementLoginCount: jest.fn() }));
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
jest.mock('#/storage/deviceId');

import { authService } from '#/services/authService';

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
  defaultShoppingListId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  navStates.clear();
  mockMutate.mockResolvedValue(SUCCESS);
  mockReadFragment.mockReturnValue(unmaskedUser);
  mockGetBiometricCapability.mockResolvedValue({ isAvailable: false });
  mockHasCredentials.mockResolvedValue(false);
  mockCheckStoredCredentials.mockResolvedValue(false);
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
