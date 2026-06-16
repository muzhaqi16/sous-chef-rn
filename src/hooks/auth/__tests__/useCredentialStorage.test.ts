import { renderHook, act } from '@testing-library/react-native';
import {
  useCredentialStorage,
  type Credentials,
} from '../useCredentialStorage';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

// Prevent transitive import: compilerSafeWrappers → errorService → telemetry → Environment.getConfig()
jest.mock('#/utils/compilerSafeWrappers');

// Mock keychain module
const mockLoadCredentials = jest.fn();
const mockLoadCredentialsForAccount = jest.fn();
const mockSaveCredentials = jest.fn();
const mockHasCredentials = jest.fn();
const mockHasCredentialsForAccount = jest.fn();
const mockClearCredentials = jest.fn();
const mockGetStoredAccounts = jest.fn();
const mockGetBiometricCapability = jest.fn();

type KeychainModule = typeof import('#/storage/keychain');

jest.mock('#/storage/keychain', () => ({
  loadSessionTokens: jest.fn(() => Promise.resolve(null)),
  saveSessionTokens: jest.fn(() => Promise.resolve()),
  clearSessionTokens: jest.fn(() => Promise.resolve()),
  loadCredentials: (...args: Parameters<KeychainModule['loadCredentials']>) =>
    mockLoadCredentials(...args),
  loadCredentialsForAccount: (
    ...args: Parameters<KeychainModule['loadCredentialsForAccount']>
  ) => mockLoadCredentialsForAccount(...args),
  saveCredentials: (...args: Parameters<KeychainModule['saveCredentials']>) =>
    mockSaveCredentials(...args),
  hasCredentials: (...args: Parameters<KeychainModule['hasCredentials']>) =>
    mockHasCredentials(...args),
  hasCredentialsForAccount: (
    ...args: Parameters<KeychainModule['hasCredentialsForAccount']>
  ) => mockHasCredentialsForAccount(...args),
  clearCredentials: (...args: Parameters<KeychainModule['clearCredentials']>) =>
    mockClearCredentials(...args),
  getStoredAccounts: (
    ...args: Parameters<KeychainModule['getStoredAccounts']>
  ) => mockGetStoredAccounts(...args),
  getBiometricCapability: (
    ...args: Parameters<KeychainModule['getBiometricCapability']>
  ) => mockGetBiometricCapability(...args),
}));

// Mock environment logger
beforeEach(() => {
  jest.clearAllMocks();
  mockHasCredentials.mockResolvedValue(false);
  mockHasCredentialsForAccount.mockResolvedValue(false);
  mockLoadCredentials.mockResolvedValue(null);
  mockLoadCredentialsForAccount.mockResolvedValue(null);
  mockSaveCredentials.mockResolvedValue(undefined);
  mockClearCredentials.mockResolvedValue(undefined);
  mockGetStoredAccounts.mockResolvedValue([]);
  mockGetBiometricCapability.mockResolvedValue({
    isAvailable: false,
    biometryType: null,
  });
});

describe('useCredentialStorage', () => {
  it('initializes with isLoadingCredentials as false', () => {
    const { result } = renderHook(() => useCredentialStorage());

    expect(result.current.isLoadingCredentials).toBe(false);
  });

  it('exposes all module-level functions', () => {
    const { result } = renderHook(() => useCredentialStorage());

    expect(typeof result.current.checkStoredCredentials).toBe('function');
    expect(typeof result.current.loadStoredCredentials).toBe('function');
    expect(typeof result.current.getAvailableAccounts).toBe('function');
    expect(typeof result.current.getBiometricInfo).toBe('function');
    expect(typeof result.current.storeCredentials).toBe('function');
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

  it('loadStoredCredentials returns mapped credentials on success', async () => {
    mockLoadCredentials.mockResolvedValue({
      username: 'user@test.com',
      password: 'pass123',
    });
    const { result } = renderHook(() => useCredentialStorage());

    let credentials: Credentials | null = null;
    await act(async () => {
      credentials = await result.current.loadStoredCredentials('user@test.com');
    });

    expect(credentials).toEqual({
      email: 'user@test.com',
      password: 'pass123',
    });
  });

  it('loadStoredCredentials returns null without a keychain call when no email provided', async () => {
    const { result } = renderHook(() => useCredentialStorage());

    let credentials: Credentials | null = null;
    await act(async () => {
      credentials = await result.current.loadStoredCredentials();
    });

    expect(credentials).toBeNull();
    expect(mockLoadCredentials).not.toHaveBeenCalled();
  });

  it('loadStoredCredentials loads the given account when email is provided', async () => {
    mockLoadCredentials.mockResolvedValue({
      username: 'specific@test.com',
      password: 'pw',
    });
    const { result } = renderHook(() => useCredentialStorage());

    let credentials: Credentials | null = null;
    await act(async () => {
      credentials = await result.current.loadStoredCredentials(
        'specific@test.com',
      );
    });

    expect(credentials).toEqual({ email: 'specific@test.com', password: 'pw' });
    expect(mockLoadCredentials).toHaveBeenCalledWith('specific@test.com');
  });

  it('storeCredentials calls saveCredentials and returns true on success', async () => {
    mockSaveCredentials.mockResolvedValue(undefined);
    const { result } = renderHook(() => useCredentialStorage());

    const success = await result.current.storeCredentials(
      'user@test.com',
      'password123',
    );

    expect(success).toBe(true);
    expect(mockSaveCredentials).toHaveBeenCalledWith(
      'user@test.com',
      'password123',
    );
  });

  it('storeCredentials returns false on error', async () => {
    mockSaveCredentials.mockRejectedValue(new Error('Save failed'));
    const { result } = renderHook(() => useCredentialStorage());

    const success = await result.current.storeCredentials(
      'user@test.com',
      'password123',
    );

    expect(success).toBe(false);
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
