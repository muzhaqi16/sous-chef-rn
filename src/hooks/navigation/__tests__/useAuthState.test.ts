import { renderHook } from '@testing-library/react-native';
import { useAuthState } from '../useAuthState';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

let mockUser: any = { id: 'u1', email: 'test@test.com' };
let mockIsHydrated = true;
let mockNavigationState = 'main_app';
let mockShowBiometricSetup = false;

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      user: mockUser,
      isHydrated: mockIsHydrated,
      navigationState: mockNavigationState,
      showBiometricSetup: mockShowBiometricSetup,
    }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' };
  mockIsHydrated = true;
  mockNavigationState = 'main_app';
  mockShowBiometricSetup = false;
});

describe('useAuthState (navigation)', () => {
  it('returns isLoading true when navigationState is loading', () => {
    mockNavigationState = 'loading';
    const { result } = renderHook(() => useAuthState());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isUnauthenticated).toBe(false);
  });

  it('returns isUnauthenticated true when navigationState is auth', () => {
    mockNavigationState = 'auth';
    const { result } = renderHook(() => useAuthState());
    expect(result.current.isUnauthenticated).toBe(true);
    expect(result.current.isFullyAuthenticated).toBe(false);
  });

  it('returns needsVerification true when navigationState is verification', () => {
    mockNavigationState = 'verification';
    const { result } = renderHook(() => useAuthState());
    expect(result.current.needsVerification).toBe(true);
  });

  it('returns needsBiometricSetup true when navigationState is biometric_setup', () => {
    mockNavigationState = 'biometric_setup';
    const { result } = renderHook(() => useAuthState());
    expect(result.current.needsBiometricSetup).toBe(true);
  });

  it('returns needsOnboarding true when navigationState is onboarding', () => {
    mockNavigationState = 'onboarding';
    const { result } = renderHook(() => useAuthState());
    expect(result.current.needsOnboarding).toBe(true);
  });

  it('returns isFullyAuthenticated true when navigationState is main_app', () => {
    mockNavigationState = 'main_app';
    const { result } = renderHook(() => useAuthState());
    expect(result.current.isFullyAuthenticated).toBe(true);
  });

  it('computes baseIsAuthenticated as true when hydrated and user exists', () => {
    const { result } = renderHook(() => useAuthState());
    expect(result.current.baseIsAuthenticated).toBe(true);
  });

  it('computes baseIsAuthenticated as false when not hydrated', () => {
    mockIsHydrated = false;
    const { result } = renderHook(() => useAuthState());
    expect(result.current.baseIsAuthenticated).toBe(false);
  });

  it('computes baseIsAuthenticated as false when user is null', () => {
    mockUser = null;
    const { result } = renderHook(() => useAuthState());
    expect(result.current.baseIsAuthenticated).toBe(false);
  });

  it('computes baseIsFullyAuthenticated when hydrated, user exists, emailVerified, and onBoarded', () => {
    mockUser = { id: 'u1', email: 'a@b.com', emailVerified: true, onBoarded: true };
    const { result } = renderHook(() => useAuthState());
    expect(result.current.baseIsFullyAuthenticated).toBe(true);
  });

  it('computes baseIsFullyAuthenticated as false when emailVerified is false', () => {
    mockUser = { id: 'u1', email: 'a@b.com', emailVerified: false, onBoarded: true };
    const { result } = renderHook(() => useAuthState());
    expect(result.current.baseIsFullyAuthenticated).toBe(false);
  });

  it('computes baseIsFullyAuthenticated as false when onBoarded is false', () => {
    mockUser = { id: 'u1', email: 'a@b.com', emailVerified: true, onBoarded: false };
    const { result } = renderHook(() => useAuthState());
    expect(result.current.baseIsFullyAuthenticated).toBe(false);
  });

  it('exposes raw values for convenience', () => {
    const { result } = renderHook(() => useAuthState());
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isHydrated).toBe(true);
    expect(result.current.navigationState).toBe('main_app');
    expect(result.current.showBiometricSetup).toBe(false);
  });

  it('exposes showBiometricSetup when set in store', () => {
    mockShowBiometricSetup = true;
    const { result } = renderHook(() => useAuthState());
    expect(result.current.showBiometricSetup).toBe(true);
  });
});
