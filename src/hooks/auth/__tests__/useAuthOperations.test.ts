import { renderHook, act } from '@testing-library/react-native';
import { useAuthOperations } from '../useAuthOperations';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

// Mock useToast
const mockToast = jest.fn();
jest.mock('#/hooks/useToast', () => ({
  useToast: () => mockToast,
}));

// Mock useErrorService
const mockHandleApolloError = jest.fn().mockReturnValue({
  message: 'An error occurred',
  code: 'UNKNOWN',
  isAuthError: false,
});
jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: mockHandleApolloError,
  }),
}));

// Mock useDeviceRegistration
const mockRegisterDeviceInBackground = jest.fn();
jest.mock('#/hooks/useDeviceRegistration', () => ({
  useDeviceRegistration: () => ({
    registerDeviceInBackground: mockRegisterDeviceInBackground,
  }),
}));

// Mock useUserPreferences
const mockShouldShowCredentialPrompt = jest.fn().mockReturnValue(true);
const mockClearRegistrationPreferences = jest.fn();
const mockTrackCredentialPromptShown = jest.fn();
const mockTrackLogout = jest.fn();
jest.mock('#/hooks/navigation/useUserPreferences', () => ({
  useUserPreferences: () => ({
    shouldShowCredentialPrompt: mockShouldShowCredentialPrompt,
    clearRegistrationPreferences: mockClearRegistrationPreferences,
    trackCredentialPromptShown: mockTrackCredentialPromptShown,
    trackLogout: mockTrackLogout,
  }),
}));

// Mock GraphQL mutations
const mockLoginMutationFn = jest.fn();
const mockRegisterMutationFn = jest.fn();
jest.mock('#generated', () => ({
  useLoginMutation: () => [mockLoginMutationFn],
  useRegisterMutation: () => [mockRegisterMutationFn],
}));

// Mock environment logger
jest.mock('#/utils/environment', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock queueManager and queueStore
jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    onLogout: jest.fn(),
    onUserChange: jest.fn(),
  },
}));
jest.mock('#/apollo/offlineQueue/queueStore', () => ({
  queueStore: {
    getCurrentUserId: jest.fn().mockReturnValue(null),
  },
}));

// Mock LogoutCleanup
jest.mock('#/apollo/logoutCleanup', () => ({
  LogoutCleanup: {
    performLogoutCleanup: jest.fn().mockResolvedValue(undefined),
    completeLogout: jest.fn(),
  },
}));

// Mock store (for bootstrapUserStore)
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      setHomeAndPantry: jest.fn(),
      setIsHomeSelectionReady: jest.fn(),
      setSelectedShoppingListId: jest.fn(),
    }),
  },
}));

// Mock keychain functions used in registerImpl
jest.mock('#/storage/keychain', () => ({
  saveTempRegistrationPassword: jest.fn().mockResolvedValue(undefined),
  clearTempRegistrationPassword: jest.fn().mockResolvedValue(undefined),
}));

// Mock incrementLoginCount
jest.mock('#/hooks/useFeatureHint', () => ({
  incrementLoginCount: jest.fn(),
}));

// Default event handler mocks
const mockOnCredentialCheck = jest.fn().mockResolvedValue(false);
const mockOnCredentialLoad = jest.fn().mockResolvedValue(null);
const mockOnCredentialStore = jest.fn().mockResolvedValue(true);
const mockOnCredentialRemove = jest.fn().mockResolvedValue(true);
const mockOnShowRememberMe = jest.fn();
const mockOnShowBiometricSetup = jest.fn();
const mockOnNavigate = jest.fn();
const mockOnSetAuth = jest.fn();
const mockOnClearAuth = jest.fn();
const mockOnSetRememberMe = jest.fn();
const mockOnSetUserNavigationState = jest.fn();
const mockOnSetRegistrationPassword = jest.fn();
const mockOnClearRegistrationPassword = jest.fn();
const mockShouldShowPostLoginBiometricPrompt = jest.fn().mockResolvedValue({ shouldShow: false });

const defaultProps = {
  credentialStorage: {
    onCredentialCheck: mockOnCredentialCheck,
    onCredentialLoad: mockOnCredentialLoad,
    onCredentialStore: mockOnCredentialStore,
    onCredentialRemove: mockOnCredentialRemove,
  },
  rememberMe: {
    onShowRememberMe: mockOnShowRememberMe,
  },
  biometricSetup: {
    onShowBiometricSetup: mockOnShowBiometricSetup,
  },
  navigation: {
    onNavigate: mockOnNavigate,
  },
  authState: {
    onSetAuth: mockOnSetAuth,
    onClearAuth: mockOnClearAuth,
    onSetRememberMe: mockOnSetRememberMe,
    onSetUserNavigationState: mockOnSetUserNavigationState,
    onSetRegistrationPassword: mockOnSetRegistrationPassword,
    onClearRegistrationPassword: mockOnClearRegistrationPassword,
  },
  shouldShowPostLoginBiometricPrompt: mockShouldShowPostLoginBiometricPrompt,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOnCredentialCheck.mockResolvedValue(false);
  mockOnCredentialLoad.mockResolvedValue(null);
  mockOnCredentialStore.mockResolvedValue(true);
  mockOnCredentialRemove.mockResolvedValue(true);
  mockLoginMutationFn.mockResolvedValue({ data: null, error: null });
  mockRegisterMutationFn.mockResolvedValue({ data: null, error: null });
  mockShouldShowPostLoginBiometricPrompt.mockResolvedValue({ shouldShow: false });
  mockShouldShowCredentialPrompt.mockReturnValue(true);
  mockHandleApolloError.mockReturnValue({
    message: 'An error occurred',
    code: 'UNKNOWN',
    isAuthError: false,
  });
});

describe('useAuthOperations', () => {
  it('initializes with isLoading false', () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    expect(result.current.isLoading).toBe(false);
  });

  it('exposes all expected functions', () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    expect(typeof result.current.login).toBe('function');
    expect(typeof result.current.register).toBe('function');
    expect(typeof result.current.logout).toBe('function');
    expect(typeof result.current.autoLogin).toBe('function');
    expect(typeof result.current.handleLogin).toBe('function');
    expect(typeof result.current.handleRegistration).toBe('function');
    expect(typeof result.current.handleAuthSuccess).toBe('function');
    expect(typeof result.current.handleAuthError).toBe('function');
    expect(typeof result.current.clearRegistrationPassword).toBe('function');
  });

  it('handleLogin sets auth state on successful login response', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const loginResponse = {
      user: { id: 'u1', email: 'test@test.com', emailVerified: true, onBoarded: true },
      accessToken: 'at',
      refreshToken: 'rt',
    };

    await act(async () => {
      await result.current.handleLogin(loginResponse, true);
    });

    expect(mockOnSetAuth).toHaveBeenCalledWith(loginResponse.user, 'at', 'rt');
    expect(mockOnSetRememberMe).toHaveBeenCalledWith(true);
    expect(mockOnSetUserNavigationState).toHaveBeenCalledWith('u1', expect.objectContaining({
      lastLoginTimestamp: expect.any(Number),
      rememberMeChoice: true,
    }));
  });

  it('handleLogin navigates to verification when email not verified', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const loginResponse = {
      user: { id: 'u1', email: 'test@test.com', emailVerified: false, onBoarded: false },
      accessToken: 'at',
      refreshToken: 'rt',
    };

    await act(async () => {
      await result.current.handleLogin(loginResponse, true);
    });

    expect(mockOnNavigate).toHaveBeenCalledWith('verification');
  });

  it('handleLogin navigates to onboarding when not onboarded', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const loginResponse = {
      user: { id: 'u1', email: 'test@test.com', emailVerified: true, onBoarded: false },
      accessToken: 'at',
      refreshToken: 'rt',
    };

    await act(async () => {
      await result.current.handleLogin(loginResponse, true);
    });

    expect(mockOnNavigate).toHaveBeenCalledWith('onboarding');
  });

  it('handleLogin navigates to main_app for fully authenticated user', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const loginResponse = {
      user: { id: 'u1', email: 'test@test.com', emailVerified: true, onBoarded: true },
      accessToken: 'at',
      refreshToken: 'rt',
    };

    await act(async () => {
      await result.current.handleLogin(loginResponse, true);
    });

    expect(mockOnNavigate).toHaveBeenCalledWith('main_app');
  });

  it('handleLogin returns false when loginResponse has no user', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let returnVal: boolean = true;
    await act(async () => {
      returnVal = await result.current.handleLogin(null);
    });

    expect(returnVal).toBe(false);
    expect(mockOnSetAuth).not.toHaveBeenCalled();
  });

  it('handleRegistration sets auth state and marks as new user', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const registerResponse = {
      user: { id: 'u2', email: 'new@test.com', emailVerified: false, onBoarded: false },
      accessToken: 'at2',
      refreshToken: 'rt2',
    };

    await act(async () => {
      await result.current.handleRegistration(registerResponse, true);
    });

    expect(mockOnSetAuth).toHaveBeenCalledWith(registerResponse.user, 'at2', 'rt2');
    expect(mockOnSetUserNavigationState).toHaveBeenCalledWith('u2', expect.objectContaining({
      isNewUser: true,
      rememberMeChoice: true,
    }));
    expect(mockOnNavigate).toHaveBeenCalledWith('verification');
  });

  it('clearRegistrationPassword calls onClearRegistrationPassword', () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    result.current.clearRegistrationPassword();

    expect(mockOnClearRegistrationPassword).toHaveBeenCalledTimes(1);
  });

  it('handleAuthSuccess does not throw', () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    expect(() => {
      result.current.handleAuthSuccess('Login successful');
    }).not.toThrow();
  });

  it('logout clears auth and navigates to auth screen', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const mockUserObj = { id: 'u1', email: 'test@test.com' };

    await act(async () => {
      await result.current.logout(mockUserObj, false);
    });

    expect(mockOnClearAuth).toHaveBeenCalled();
    expect(mockOnNavigate).toHaveBeenCalledWith('auth');
  });

  // Additional tests for uncovered branches

  it('login calls loginMutation and handles successful response', async () => {
    mockLoginMutationFn.mockResolvedValue({
      data: {
        login: {
          user: { id: 'u1', email: 'test@test.com', emailVerified: true, onBoarded: true },
          accessToken: 'at',
          refreshToken: 'rt',
        },
      },
    });

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.login({ email: 'test@test.com', password: 'pass123' });
    });

    expect(success).toBe(true);
    expect(mockLoginMutationFn).toHaveBeenCalledWith({
      variables: { input: { email: 'test@test.com', password: 'pass123' } },
    });
  });

  it('login handles mutation error', async () => {
    mockLoginMutationFn.mockResolvedValue({
      data: null,
      error: new Error('Invalid credentials'),
    });

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.login({ email: 'test@test.com', password: 'wrong' });
    });

    expect(success).toBe(false);
  });

  it('login shows remember me prompt when conditions met', async () => {
    mockLoginMutationFn.mockResolvedValue({
      data: {
        login: {
          user: { id: 'u1', email: 'test@test.com', emailVerified: true, onBoarded: true },
          accessToken: 'at',
          refreshToken: 'rt',
        },
      },
    });
    mockOnCredentialCheck.mockResolvedValue(false);
    mockShouldShowCredentialPrompt.mockReturnValue(true);

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    await act(async () => {
      await result.current.login({ email: 'test@test.com', password: 'pass123' }, true);
    });

    expect(mockOnShowRememberMe).toHaveBeenCalled();
    expect(mockTrackCredentialPromptShown).toHaveBeenCalled();
  });

  it('register calls registerMutation and handles success', async () => {
    mockRegisterMutationFn.mockResolvedValue({
      data: {
        register: {
          user: { id: 'u2', email: 'new@test.com', emailVerified: false, onBoarded: false },
          accessToken: 'at2',
          refreshToken: 'rt2',
        },
      },
    });

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.register({
        email: 'new@test.com',
        password: 'pass123',
        displayName: 'New User',
      } as any);
    });

    expect(success).toBe(true);
    expect(mockOnSetRegistrationPassword).toHaveBeenCalledWith('pass123');
  });

  it('register handles mutation error', async () => {
    mockRegisterMutationFn.mockResolvedValue({
      data: null,
      error: new Error('Email already exists'),
    });

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.register({
        email: 'existing@test.com',
        password: 'pass123',
        displayName: 'Test',
      } as any);
    });

    expect(success).toBe(false);
  });

  it('autoLogin returns false when no stored credentials', async () => {
    mockOnCredentialCheck.mockResolvedValue(false);

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let success: boolean = true;
    await act(async () => {
      success = await result.current.autoLogin();
    });

    expect(success).toBe(false);
  });

  it('autoLogin uses stored credentials', async () => {
    mockOnCredentialCheck.mockResolvedValue(true);
    mockOnCredentialLoad.mockResolvedValue({ email: 'stored@test.com', password: 'stored-pass' });
    mockLoginMutationFn.mockResolvedValue({
      data: {
        login: {
          user: { id: 'u1', email: 'stored@test.com', emailVerified: true, onBoarded: true },
          accessToken: 'at',
          refreshToken: 'rt',
        },
      },
    });

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    let success: boolean = false;
    await act(async () => {
      success = await result.current.autoLogin();
    });

    expect(success).toBe(true);
    expect(mockLoginMutationFn).toHaveBeenCalledWith({
      variables: { input: { email: 'stored@test.com', password: 'stored-pass' } },
    });
  });

  it('logout with clearAllCredentials removes all credentials', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    await act(async () => {
      await result.current.logout({ id: 'u1', email: 'test@test.com' }, true);
    });

    expect(mockOnCredentialRemove).toHaveBeenCalledWith();
  });

  it('handleLogin triggers biometric setup when eligible', async () => {
    mockShouldShowPostLoginBiometricPrompt.mockResolvedValue({ shouldShow: true });

    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const loginResponse = {
      user: { id: 'u1', email: 'test@test.com', emailVerified: true, onBoarded: true },
      accessToken: 'at',
      refreshToken: 'rt',
    };
    const credentials = { email: 'test@test.com', password: 'pass123' };

    let returnVal: boolean = false;
    await act(async () => {
      returnVal = await result.current.handleLogin(loginResponse, true, credentials);
    });

    expect(returnVal).toBe(true);
    expect(mockOnShowBiometricSetup).toHaveBeenCalledWith(credentials);
  });

  it('handleRegistration navigates to main_app for verified+onboarded user', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    const response = {
      user: { id: 'u3', email: 'user@test.com', emailVerified: true, onBoarded: true },
      accessToken: 'at3',
      refreshToken: 'rt3',
    };

    await act(async () => {
      await result.current.handleRegistration(response);
    });

    expect(mockOnNavigate).toHaveBeenCalledWith('main_app');
  });

  it('handleRegistration does nothing when response has no user', async () => {
    const { result } = renderHook(() => useAuthOperations(defaultProps));

    await act(async () => {
      await result.current.handleRegistration(null);
    });

    expect(mockOnSetAuth).not.toHaveBeenCalled();
  });
});
