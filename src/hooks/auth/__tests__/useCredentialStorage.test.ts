import { renderHook, act } from '@testing-library/react-native';
import { useCredentialStorage } from '../useCredentialStorage';

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

jest.mock('#/storage/keychain', () => ({
  loadCredentials: (...args: any[]) => mockLoadCredentials(...args),
  loadCredentialsForAccount: (...args: any[]) =>
    mockLoadCredentialsForAccount(...args),
  saveCredentials: (...args: any[]) => mockSaveCredentials(...args),
  hasCredentials: (...args: any[]) => mockHasCredentials(...args),
  hasCredentialsForAccount: (...args: any[]) =>
    mockHasCredentialsForAccount(...args),
  clearCredentials: (...args: any[]) => mockClearCredentials(...args),
  getStoredAccounts: (...args: any[]) => mockGetStoredAccounts(...args),
  getBiometricCapability: (...args: any[]) =>
    mockGetBiometricCapability(...args),
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

  it('checkStoredCredentials calls hasCredentials when no email provided', async () => {
    mockHasCredentials.mockResolvedValue(true);
    const { result } = renderHook(() => useCredentialStorage());

    const hasCreds = await result.current.checkStoredCredentials();

    expect(hasCreds).toBe(true);
    expect(mockHasCredentials).toHaveBeenCalledTimes(1);
  });

  it('checkStoredCredentials calls hasCredentialsForAccount when email provided', async () => {
    mockHasCredentialsForAccount.mockResolvedValue(true);
    const { result } = renderHook(() => useCredentialStorage());

    const hasCreds = await result.current.checkStoredCredentials(
      'test@test.com',
    );

    expect(hasCreds).toBe(true);
    expect(mockHasCredentialsForAccount).toHaveBeenCalledWith();
  });

  it('checkStoredCredentials returns false on error', async () => {
    mockHasCredentials.mockRejectedValue(new Error('Keychain error'));
    const { result } = renderHook(() => useCredentialStorage());

    const hasCreds = await result.current.checkStoredCredentials();

    expect(hasCreds).toBe(false);
  });

  it('loadStoredCredentials returns mapped credentials on success', async () => {
    mockLoadCredentials.mockResolvedValue({
      username: 'user@test.com',
      password: 'pass123',
    });
    const { result } = renderHook(() => useCredentialStorage());

    let credentials: any;
    await act(async () => {
      credentials = await result.current.loadStoredCredentials();
    });

    expect(credentials).toEqual({
      email: 'user@test.com',
      password: 'pass123',
    });
  });

  it('loadStoredCredentials returns null when no credentials found', async () => {
    mockLoadCredentials.mockResolvedValue(null);
    const { result } = renderHook(() => useCredentialStorage());

    let credentials: any;
    await act(async () => {
      credentials = await result.current.loadStoredCredentials();
    });

    expect(credentials).toBeNull();
  });

  it('loadStoredCredentials calls loadCredentialsForAccount when email is provided', async () => {
    mockLoadCredentialsForAccount.mockResolvedValue({
      username: 'specific@test.com',
      password: 'pw',
    });
    const { result } = renderHook(() => useCredentialStorage());

    let credentials: any;
    await act(async () => {
      credentials = await result.current.loadStoredCredentials(
        'specific@test.com',
      );
    });

    expect(credentials).toEqual({ email: 'specific@test.com', password: 'pw' });
    expect(mockLoadCredentialsForAccount).toHaveBeenCalledWith();
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

    const success = await result.current.removeCredentials();

    expect(success).toBe(false);
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
