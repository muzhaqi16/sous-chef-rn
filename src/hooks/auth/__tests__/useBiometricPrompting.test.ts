import { renderHook } from '@testing-library/react-native';
import { useBiometricPrompting } from '../useBiometricPrompting';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

// Mock keychain
const mockHasCredentialsForAccount = jest.fn();
const mockGetBiometricCapability = jest.fn();

jest.mock('#/storage/keychain', () => ({
  hasCredentialsForAccount: (...args: any[]) => mockHasCredentialsForAccount(...args),
  getBiometricCapability: (...args: any[]) => mockGetBiometricCapability(...args),
}));

// Mock store
let mockUser: any = { id: 'u1', email: 'test@test.com' };
const mockSetUserNavigationState = jest.fn();
const mockGetUserNavigationState = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      user: mockUser,
      setUserNavigationState: mockSetUserNavigationState,
      getUserNavigationState: mockGetUserNavigationState,
    }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' };
  mockGetUserNavigationState.mockReturnValue(null);
  mockGetBiometricCapability.mockResolvedValue({ isAvailable: true, biometryType: 'FaceID' });
  mockHasCredentialsForAccount.mockResolvedValue(false);
});

describe('useBiometricPrompting', () => {
  it('returns shouldShow false when no user exists', async () => {
    mockUser = null;
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt();

    expect(decision.shouldShow).toBe(false);
    expect(decision.reason).toBe('No user found');
  });

  it('returns shouldShow false for new user not yet onboarded', async () => {
    mockGetUserNavigationState.mockReturnValue({ isNewUser: true, hasCompletedOnboarding: false });
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt();

    expect(decision.shouldShow).toBe(false);
    expect(decision.reason).toContain('New user');
  });

  it('returns shouldShow false when biometric is not available', async () => {
    mockGetBiometricCapability.mockResolvedValue({ isAvailable: false, biometryType: null });
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt();

    expect(decision.shouldShow).toBe(false);
    expect(decision.reason).toBe('Biometric not available');
  });

  it('returns shouldShow false when user already has credentials saved', async () => {
    mockHasCredentialsForAccount.mockResolvedValue(true);
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt();

    expect(decision.shouldShow).toBe(false);
    expect(decision.reason).toBe('Already has biometric setup');
  });

  it('returns shouldShow false when user permanently declined biometric', async () => {
    mockGetUserNavigationState.mockReturnValue({ biometricDeclinedPermanently: true });
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt();

    expect(decision.shouldShow).toBe(false);
    expect(decision.reason).toContain('permanently declined');
  });

  it('returns shouldShow true when eligible for biometric prompt', async () => {
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt();

    expect(decision.shouldShow).toBe(true);
  });

  it('accepts targetUser parameter for prompt decision', async () => {
    mockUser = null; // No store user
    const { result } = renderHook(() => useBiometricPrompting());

    const decision = await result.current.shouldShowPostLoginBiometricPrompt({
      id: 'u2',
      email: 'other@test.com',
    });

    expect(decision.shouldShow).toBe(true);
    expect(mockGetUserNavigationState).toHaveBeenCalledWith('u2');
    expect(mockHasCredentialsForAccount).toHaveBeenCalledWith();
  });

  it('recordBiometricPromptResponse records enabled state', () => {
    const { result } = renderHook(() => useBiometricPrompting());

    result.current.recordBiometricPromptResponse(true);

    expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
      biometricEnabled: true,
      biometricDeclinedPermanently: false,
    });
  });

  it('recordBiometricPromptResponse records permanent decline', () => {
    const { result } = renderHook(() => useBiometricPrompting());

    result.current.recordBiometricPromptResponse(false, true);

    expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
      biometricDeclinedPermanently: true,
    });
  });

  it('recordBiometricPromptResponse does nothing without user', () => {
    mockUser = null;
    const { result } = renderHook(() => useBiometricPrompting());

    result.current.recordBiometricPromptResponse(true);

    expect(mockSetUserNavigationState).not.toHaveBeenCalled();
  });

  it('resetBiometricDeclination clears the permanent decline flag', () => {
    const { result } = renderHook(() => useBiometricPrompting());

    result.current.resetBiometricDeclination();

    expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
      biometricDeclinedPermanently: false,
    });
  });

  it('resetBiometricDeclination does nothing without user', () => {
    mockUser = null;
    const { result } = renderHook(() => useBiometricPrompting());

    result.current.resetBiometricDeclination();

    expect(mockSetUserNavigationState).not.toHaveBeenCalled();
  });
});
