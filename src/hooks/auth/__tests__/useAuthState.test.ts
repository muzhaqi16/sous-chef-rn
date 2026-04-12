import { renderHook } from '@testing-library/react-native';
import { useAuthState } from '../useAuthState';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

// Mock store values
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

let mockUser: any = { id: 'u1', email: 'test@test.com' };
let mockAccessToken: string | null = 'access-token';
let mockRefreshToken: string | null = 'refresh-token';
let mockIsLoggingOut = false;
let mockIsAutoLoggingIn = false;
let mockNavigationState = 'auth';
let mockShowBiometricSetup = false;
let mockPostLoginCredentials: any = null;

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      user: mockUser,
      accessToken: mockAccessToken,
      refreshToken: mockRefreshToken,
      isLoggingOut: mockIsLoggingOut,
      isAutoLoggingIn: mockIsAutoLoggingIn,
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
      postLoginCredentials: mockPostLoginCredentials,
      setNavigationState: mockSetNavigationState,
      setShowBiometricSetup: mockSetShowBiometricSetup,
      setPostLoginCredentials: mockSetPostLoginCredentials,
    }),
  useAuthTokens: jest.fn(() => ({
    user: mockUser,
    accessToken: mockAccessToken,
    refreshToken: mockRefreshToken,
    isAutoLoggingIn: mockIsAutoLoggingIn,
    isLoggingOut: mockIsLoggingOut,
  })),
  useAuthActions: jest.fn(() => ({
    setAuth: mockSetAuth,
    clearAuth: mockClearAuth,
    setTokens: mockSetTokens,
    updateUser: mockUpdateUser,
    setEmailVerified: mockSetEmailVerified,
    setOnboarded: mockSetOnboarded,
    setRememberMe: mockSetRememberMe,
    setIsAutoLoggingIn: mockSetIsAutoLoggingIn,
    setUserNavigationState: mockSetUserNavigationState,
  })),
  usePostLoginState: jest.fn(() => ({
    navigationState: mockNavigationState,
    showBiometricSetup: mockShowBiometricSetup,
    postLoginCredentials: mockPostLoginCredentials,
    setNavigationState: mockSetNavigationState,
    setShowBiometricSetup: mockSetShowBiometricSetup,
    setPostLoginCredentials: mockSetPostLoginCredentials,
  })),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' };
  mockAccessToken = 'access-token';
  mockRefreshToken = 'refresh-token';
  mockIsLoggingOut = false;
  mockIsAutoLoggingIn = false;
  mockNavigationState = 'auth';
  mockShowBiometricSetup = false;
  mockPostLoginCredentials = null;
});

describe('useAuthState', () => {
  it('returns core auth state from the store', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current.user).toEqual({ id: 'u1', email: 'test@test.com' });
    expect(result.current.accessToken).toBe('access-token');
    expect(result.current.refreshToken).toBe('refresh-token');
    expect(result.current.isLoggingOut).toBe(false);
    expect(result.current.isAutoLoggingIn).toBe(false);
  });

  it('computes isAuthenticated as true when user and accessToken exist', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('computes isAuthenticated as false when user is null', () => {
    mockUser = null;

    const { result } = renderHook(() => useAuthState());

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('computes isAuthenticated as false when accessToken is null', () => {
    mockAccessToken = null;

    const { result } = renderHook(() => useAuthState());

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('computes hasAnyToken correctly', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current.hasAnyToken).toBe(true);
  });

  it('computes hasAnyToken as false when both tokens are null', () => {
    mockAccessToken = null;
    mockRefreshToken = null;

    const { result } = renderHook(() => useAuthState());

    expect(result.current.hasAnyToken).toBe(false);
  });

  it('computes isLoggedOut when user and both tokens are null', () => {
    mockUser = null;
    mockAccessToken = null;
    mockRefreshToken = null;

    const { result } = renderHook(() => useAuthState());

    expect(result.current.isLoggedOut).toBe(true);
  });

  it('computes isTokenRefreshing when accessToken is null but refreshToken exists', () => {
    mockAccessToken = null;
    mockRefreshToken = 'refresh-token';

    const { result } = renderHook(() => useAuthState());

    expect(result.current.isTokenRefreshing).toBe(true);
  });

  it('computes canAttemptQueries as true when hasAnyToken and not logging out', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current.canAttemptQueries).toBe(true);
  });

  it('computes canAttemptQueries as false when isLoggingOut is true', () => {
    mockIsLoggingOut = true;

    const { result } = renderHook(() => useAuthState());

    expect(result.current.canAttemptQueries).toBe(false);
  });

  it('exposes all auth state actions', () => {
    const { result } = renderHook(() => useAuthState());

    expect(result.current.setAuth).toBe(mockSetAuth);
    expect(result.current.clearAuth).toBe(mockClearAuth);
    expect(result.current.setTokens).toBe(mockSetTokens);
    expect(result.current.updateUser).toBe(mockUpdateUser);
    expect(result.current.setEmailVerified).toBe(mockSetEmailVerified);
    expect(result.current.setOnboarded).toBe(mockSetOnboarded);
    expect(result.current.setRememberMe).toBe(mockSetRememberMe);
    expect(result.current.setIsAutoLoggingIn).toBe(mockSetIsAutoLoggingIn);
    expect(result.current.setUserNavigationState).toBe(
      mockSetUserNavigationState,
    );
  });

  it('exposes post-login navigation state', () => {
    mockNavigationState = 'main_app';
    mockShowBiometricSetup = true;
    mockPostLoginCredentials = { email: 'a@b.com', password: 'pw' };

    const { result } = renderHook(() => useAuthState());

    expect(result.current.navigationState).toBe('main_app');
    expect(result.current.showBiometricSetup).toBe(true);
    expect(result.current.postLoginCredentials).toEqual({
      email: 'a@b.com',
      password: 'pw',
    });
    expect(result.current.setNavigationState).toBe(mockSetNavigationState);
    expect(result.current.setShowBiometricSetup).toBe(
      mockSetShowBiometricSetup,
    );
    expect(result.current.setPostLoginCredentials).toBe(
      mockSetPostLoginCredentials,
    );
  });
});
