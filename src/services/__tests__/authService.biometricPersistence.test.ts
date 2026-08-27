// Biometric credentials must SURVIVE a sign-out.
//
// `logout()` used to end with `removeCredentials(currentUserEmail)`, which
// resets both keychain slots for that account — the biometry-gated credential
// service and the unprotected "credentials exist" indicator. That one line made
// biometric login structurally impossible:
//
//   • `LoginScreen` shows its biometric button only when `hasCredentials` is
//     true, so after any sign-out the button was gone;
//   • `shouldShowPostLoginBiometricPrompt` checks the same thing, so every
//     fresh login asked the user to enrol AGAIN; and
//   • `autoLogin()` could never succeed after a manual sign-out.
//
// The user-visible shape was "it keeps asking me to register my fingerprint but
// never offers to log in with it". Nothing caught it: `sessionEndLeavesNoData`
// classifies persisted STORE keys on purpose, and the keychain is not in its
// inventory — so deleting credentials read as correct cleanup.
//
// These tests pin both directions: an ordinary sign-out leaves the slot alone,
// and `forgetDevice` (account deletion) still clears it.

const mockMutate = jest.fn();
jest.mock('#/apollo/client', () => ({
  client: { mutate: (...args: unknown[]) => mockMutate(...args) },
  cancelCachePersistence: jest.fn(),
  flushCachePersistence: jest.fn(),
}));

const mockResetStore = jest.fn().mockResolvedValue(undefined);
const mockSetNavigationState = jest.fn();
const mockStoreState: Record<string, unknown> = {
  user: { id: 'u1', email: 'chef@example.com' },
  resetStore: (...a: unknown[]) => mockResetStore(...a),
  setNavigationState: (...a: unknown[]) => mockSetNavigationState(...a),
  setAuthIsLoading: jest.fn(),
  getUserNavigationState: jest.fn().mockReturnValue({}),
  setUserNavigationState: jest.fn(),
};
jest.mock('#store', () => ({
  useStore: { getState: () => mockStoreState },
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
jest.mock('#/storage/keychain', () => ({
  clearCredentials: (...a: unknown[]) => mockClearCredentials(...a),
  loadCredentials: jest.fn(),
  saveCredentials: jest.fn(),
  hasCredentials: jest.fn().mockResolvedValue(true),
  getStoredAccounts: jest.fn().mockResolvedValue([]),
  getBiometricCapability: jest
    .fn()
    .mockResolvedValue({ isAvailable: true, biometryType: 'Fingerprint' }),
  getLastBiometricEmail: jest.fn().mockResolvedValue('chef@example.com'),
  saveTempRegistrationPassword: jest.fn(),
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

import { authService } from '#/services/authService';

describe('logout and biometric credentials', () => {
  beforeEach(() => {
    mockClearCredentials.mockClear();
    mockMutate.mockResolvedValue({ data: {} });
  });

  it('leaves the stored credentials in place on an ordinary sign-out', async () => {
    await authService.logout();

    // The whole point: signing out is not the same as forgetting the device,
    // and the next login screen must still be able to offer biometric login.
    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('still signs the user out of the session itself', async () => {
    await authService.logout();

    // Keeping credentials must not be mistaken for keeping the session.
    expect(mockResetStore).toHaveBeenCalledWith(
      expect.objectContaining({ auth: true }),
    );
    expect(mockSetNavigationState).toHaveBeenCalledWith('auth');
  });

  it('clears them when the account itself is going away', async () => {
    await authService.logout({ forgetDevice: true });

    expect(mockClearCredentials).toHaveBeenCalledWith('chef@example.com');
  });
});
