import { renderHook } from '@testing-library/react-native';
import { useCredentialStorage } from '#features/profile/hooks/useCredentialStorage';

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// Prevent transitive import: errorService → telemetry → Environment.getConfig()
jest.mock('#/utils/finallyHelpers');

// Mock keychain module
const mockHasCredentials = jest.fn();
const mockClearCredentials = jest.fn();
const mockGetBiometricCapability = jest.fn();

type KeychainModule = typeof import('#/storage/keychain');

jest.mock('#/storage/keychain', () => ({
  loadSessionTokens: jest.fn(() => Promise.resolve(null)),
  saveSessionTokens: jest.fn(() => Promise.resolve()),
  clearSessionTokens: jest.fn(() => Promise.resolve()),
  hasCredentials: (...args: Parameters<KeychainModule['hasCredentials']>) =>
    mockHasCredentials(...args),
  clearCredentials: (...args: Parameters<KeychainModule['clearCredentials']>) =>
    mockClearCredentials(...args),
  getBiometricCapability: (
    ...args: Parameters<KeychainModule['getBiometricCapability']>
  ) => mockGetBiometricCapability(...args),
}));

// Mock environment logger
beforeEach(() => {
  jest.clearAllMocks();
  mockHasCredentials.mockResolvedValue(false);
  mockClearCredentials.mockResolvedValue(undefined);
  mockGetBiometricCapability.mockResolvedValue({
    isAvailable: false,
    biometryType: null,
  });
});

describe('useCredentialStorage', () => {
  it('exposes all module-level functions', () => {
    const { result } = renderHook(() => useCredentialStorage());

    expect(typeof result.current.checkStoredCredentials).toBe('function');
    expect(typeof result.current.getBiometricInfo).toBe('function');
    expect(typeof result.current.removeCredentials).toBe('function');
  });

  it('checkStoredCredentials returns false without a keychain call when no email provided', async () => {
    const { result } = renderHook(() => useCredentialStorage());

    const hasCreds = await result.current.checkStoredCredentials();

    expect(hasCreds).toBe(false);
    expect(mockHasCredentials).not.toHaveBeenCalled();
  });

  it('checkStoredCredentials checks the given account when email provided', async () => {
    mockHasCredentials.mockResolvedValue(true);
    const { result } = renderHook(() => useCredentialStorage());

    const hasCreds = await result.current.checkStoredCredentials(
      'test@test.com',
    );

    expect(hasCreds).toBe(true);
    expect(mockHasCredentials).toHaveBeenCalledWith('test@test.com');
  });

  it('checkStoredCredentials returns false on error', async () => {
    mockHasCredentials.mockRejectedValue(new Error('Keychain error'));
    const { result } = renderHook(() => useCredentialStorage());

    const hasCreds = await result.current.checkStoredCredentials(
      'test@test.com',
    );

    expect(hasCreds).toBe(false);
  });

  it('removeCredentials calls clearCredentials and returns true on success', async () => {
    mockClearCredentials.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCredentialStorage());

    const success = await result.current.removeCredentials('user@test.com');

    expect(success).toBe(true);
    expect(mockClearCredentials).toHaveBeenCalledWith('user@test.com');
  });

  it('removeCredentials returns false on error', async () => {
    mockClearCredentials.mockRejectedValue(new Error('Clear failed'));
    const { result } = renderHook(() => useCredentialStorage());

    const success = await result.current.removeCredentials('user@test.com');

    expect(success).toBe(false);
  });

  it('removeCredentials returns false without a keychain call when no email provided', async () => {
    const { result } = renderHook(() => useCredentialStorage());

    const success = await result.current.removeCredentials();

    expect(success).toBe(false);
    expect(mockClearCredentials).not.toHaveBeenCalled();
  });

  it('getBiometricInfo returns biometric capability info', async () => {
    mockGetBiometricCapability.mockResolvedValue({
      isAvailable: true,
      biometryType: 'FaceID',
    });
    const { result } = renderHook(() => useCredentialStorage());

    const info = await result.current.getBiometricInfo();

    expect(info).toEqual({ isAvailable: true, biometryType: 'FaceID' });
  });

  it('getBiometricInfo returns fallback on error', async () => {
    mockGetBiometricCapability.mockRejectedValue(new Error('Biometric error'));
    const { result } = renderHook(() => useCredentialStorage());

    const info = await result.current.getBiometricInfo();

    expect(info).toEqual({ isAvailable: false, biometryType: null });
  });
});
