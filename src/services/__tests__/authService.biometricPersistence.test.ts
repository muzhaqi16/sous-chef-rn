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

import { logger } from '#/utils/environment';
import { authService } from '#/services/authService';

describe('logout and biometric credentials', () => {
  beforeEach(() => {
    mockClearCredentials.mockClear();
    mockMutate.mockResolvedValue({ data: {} });
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

  it('reports a keychain delete that did not succeed', async () => {
    // A failed delete leaves the previous user's password on the device. It
    // must not be indistinguishable from success — the boolean was discarded.
    mockClearCredentials.mockRejectedValueOnce(new Error('keychain locked'));

    await authService.logout();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('could not be removed'),
    );
  });
});
