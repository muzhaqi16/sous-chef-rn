import { renderHook, act } from '@testing-library/react-native';
import type { User } from '#store/slices/authSlice';
import type { RootState } from '#store/index';
import { useAuth } from '../useAuth';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

// --- Mock useAuthState ---
const mockSetAuth = jest.fn();
const mockClearAuth = jest.fn();
const mockSetTokens = jest.fn();
const mockUpdateUser = jest.fn();
const mockSetEmailVerified = jest.fn();
const mockSetOnboarded = jest.fn();
const mockSetRememberMe = jest.fn();
const mockSetIsAutoLoggingIn = jest.fn();
const mockSetUserNavigationState = jest.fn();
const mockSetNavigationState = jest.fn();
const mockSetShowBiometricSetup = jest.fn();
const mockSetPostLoginCredentials = jest.fn();

let mockUser: User | null = {
  id: 'u1',
  email: 'test@test.com',
} as Partial<User> as User;
let mockNavigationState = 'auth';
let mockShowBiometricSetup = false;

jest.mock('../useAuthState', () => ({
  useAuthState: () => ({
    user: mockUser,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    isLoggingOut: false,
    isAutoLoggingIn: false,
    isAuthenticated: true,
    hasAnyToken: true,
    isLoggedOut: false,
    isTokenRefreshing: false,
    canAttemptQueries: true,
    setAuth: mockSetAuth,
    clearAuth: mockClearAuth,
    setTokens: mockSetTokens,
    updateUser: mockUpdateUser,
    setEmailVerified: mockSetEmailVerified,
    setOnboarded: mockSetOnboarded,
    setRememberMe: mockSetRememberMe,
    setIsAutoLoggingIn: mockSetIsAutoLoggingIn,
    setUserNavigationState: mockSetUserNavigationState,
    navigationState: mockNavigationState,
    showBiometricSetup: mockShowBiometricSetup,
    postLoginCredentials: null,
    setNavigationState: mockSetNavigationState,
    setShowBiometricSetup: mockSetShowBiometricSetup,
    setPostLoginCredentials: mockSetPostLoginCredentials,
  }),
}));

// --- Mock useCredentialStorage ---
const mockCheckStoredCredentials = jest.fn().mockResolvedValue(false);
const mockLoadStoredCredentials = jest.fn().mockResolvedValue(null);
const mockStoreCredentials = jest.fn().mockResolvedValue(true);
const mockRemoveCredentials = jest.fn().mockResolvedValue(true);
const mockGetAvailableAccounts = jest.fn().mockResolvedValue([]);
const mockGetBiometricInfo = jest
  .fn()
  .mockResolvedValue({ isAvailable: false, biometryType: null });

jest.mock('../useCredentialStorage', () => ({
  useCredentialStorage: () => ({
    isLoadingCredentials: false,
    checkStoredCredentials: mockCheckStoredCredentials,
    loadStoredCredentials: mockLoadStoredCredentials,
    storeCredentials: mockStoreCredentials,
    removeCredentials: mockRemoveCredentials,
    getAvailableAccounts: mockGetAvailableAccounts,
    getBiometricInfo: mockGetBiometricInfo,
  }),
}));

// --- Mock useBiometricPrompting ---
const mockShouldShowPostLoginBiometricPrompt = jest
  .fn()
  .mockResolvedValue({ shouldShow: false });
const mockRecordBiometricPromptResponse = jest.fn();

jest.mock('../useBiometricPrompting', () => ({
  useBiometricPrompting: () => ({
    shouldShowPostLoginBiometricPrompt: mockShouldShowPostLoginBiometricPrompt,
    recordBiometricPromptResponse: mockRecordBiometricPromptResponse,
  }),
}));

// --- Mock useRememberMe ---
const mockShowRememberMePrompt = jest.fn();
const mockHandleRememberMeAccept = jest.fn();
const mockHandleRememberMeDecline = jest.fn();

jest.mock('../useRememberMe', () => ({
  useRememberMe: () => ({
    showRememberMeModal: false,
    pendingCredentials: null,
    handleRememberMeAccept: mockHandleRememberMeAccept,
    handleRememberMeDecline: mockHandleRememberMeDecline,
    showRememberMePrompt: mockShowRememberMePrompt,
    setShowRememberMeModal: jest.fn(),
    setPendingCredentials: jest.fn(),
  }),
}));

// --- Mock useAuthOperations ---
const mockLogin = jest.fn().mockResolvedValue(true);
const mockRegister = jest.fn().mockResolvedValue(true);
const mockOperationsLogout = jest.fn().mockResolvedValue(undefined);
const mockAutoLogin = jest.fn().mockResolvedValue(false);
const mockHandleLogin = jest.fn().mockResolvedValue(false);
const mockHandleRegistration = jest.fn().mockResolvedValue(undefined);
const mockHandleAuthSuccess = jest.fn();
const mockHandleAuthError = jest.fn();
const mockOpsClearRegistrationPassword = jest.fn();

jest.mock('../useAuthOperations', () => ({
  useAuthOperations: () => ({
    isLoading: false,
    login: mockLogin,
    register: mockRegister,
    logout: mockOperationsLogout,
    autoLogin: mockAutoLogin,
    handleLogin: mockHandleLogin,
    handleRegistration: mockHandleRegistration,
    handleAuthSuccess: mockHandleAuthSuccess,
    handleAuthError: mockHandleAuthError,
    clearRegistrationPassword: mockOpsClearRegistrationPassword,
  }),
}));

// --- Mock useAuthPreferences ---
const mockMarkBiometricDeclined = jest.fn();
const mockMarkBiometricEnabled = jest.fn();

jest.mock('#/hooks/navigation/useAuthPreferences', () => ({
  useAuthPreferences: () => ({
    markBiometricDeclined: mockMarkBiometricDeclined,
    markBiometricEnabled: mockMarkBiometricEnabled,
  }),
}));

// --- Mock store for registrationPassword ---
let mockRegistrationPassword: string | null = null;
const mockSetRegistrationPassword = jest.fn();
const mockStoreClearRegistrationPassword = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector({
      registrationPassword: mockRegistrationPassword,
      setRegistrationPassword: mockSetRegistrationPassword,
      clearRegistrationPassword: mockStoreClearRegistrationPassword,
    } as Partial<RootState> as RootState),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' } as Partial<User> as User;
  mockNavigationState = 'auth';
  mockShowBiometricSetup = false;
  mockRegistrationPassword = null;
});

describe('useAuth', () => {
  it('exposes auth state from useAuthState', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toEqual({ id: 'u1', email: 'test@test.com' });
    expect(result.current.accessToken).toBe('access-token');
    expect(result.current.refreshToken).toBe('refresh-token');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.hasAnyToken).toBe(true);
    expect(result.current.isLoggedOut).toBe(false);
    expect(result.current.canAttemptQueries).toBe(true);
  });

  it('exposes loading states', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isLoadingCredentials).toBe(false);
  });

  it('exposes auth operations (login, register, autoLogin)', () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.autoLogin).toBe('function');
  });

  it('exposes credential management functions', () => {
    const { result } = renderHook(() => useAuth());

    expect(typeof result.current.checkStoredCredentials).toBe('function');
    expect(typeof result.current.loadStoredCredentials).toBe('function');
    expect(typeof result.current.storeCredentials).toBe('function');
    expect(typeof result.current.removeCredentials).toBe('function');
    expect(typeof result.current.getAvailableAccounts).toBe('function');
    expect(typeof result.current.getBiometricInfo).toBe('function');
  });

  it('exposes RememberMe modal state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.showRememberMeModal).toBe(false);
    expect(result.current.pendingCredentials).toBeNull();
    expect(typeof result.current.handleRememberMeAccept).toBe('function');
    expect(typeof result.current.handleRememberMeDecline).toBe('function');
  });

  it('exposes navigation state from useAuthState', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.navigationState).toBe('auth');
    expect(typeof result.current.setNavigationState).toBe('function');
    expect(typeof result.current.setShowBiometricSetup).toBe('function');
  });

  it('exposes registration password from store', () => {
    mockRegistrationPassword = 'secret123';
    const { result } = renderHook(() => useAuth());

    expect(result.current.registrationPassword).toBe('secret123');
    expect(typeof result.current.setRegistrationPassword).toBe('function');
    expect(typeof result.current.clearRegistrationPassword).toBe('function');
  });

  it('logout wrapper passes current user to authOperations.logout', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout(true);
    });

    expect(mockOperationsLogout).toHaveBeenCalledWith(
      { id: 'u1', email: 'test@test.com' },
      true,
    );
  });

  it('logout wrapper defaults clearAllCredentials to false', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(mockOperationsLogout).toHaveBeenCalledWith(
      { id: 'u1', email: 'test@test.com' },
      false,
    );
  });

  it('handlePostLoginBiometricComplete closes biometric setup and navigates to main_app', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.handlePostLoginBiometricComplete(true, false);
    });

    expect(mockSetShowBiometricSetup).toHaveBeenCalledWith(false);
    expect(mockRecordBiometricPromptResponse).toHaveBeenCalledWith(true, false);
    expect(mockMarkBiometricEnabled).toHaveBeenCalledTimes(1);
    expect(mockSetNavigationState).toHaveBeenCalledWith('main_app');
    expect(mockSetPostLoginCredentials).toHaveBeenCalledWith(null);
  });

  it('handlePostLoginBiometricComplete handles decline with markBiometricDeclined', () => {
    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.handlePostLoginBiometricComplete(false, true);
    });

    expect(mockSetShowBiometricSetup).toHaveBeenCalledWith(false);
    expect(mockRecordBiometricPromptResponse).toHaveBeenCalledWith(false, true);
    expect(mockMarkBiometricDeclined).toHaveBeenCalledTimes(1);
    expect(mockMarkBiometricEnabled).not.toHaveBeenCalled();
    expect(mockSetNavigationState).toHaveBeenCalledWith('main_app');
  });
});
