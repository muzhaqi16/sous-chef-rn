import { renderHook } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import { useBiometricPrompting } from '../useBiometricPrompting';

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

// The hook does not touch the keychain — only the session-token stubs are
// needed to keep the import chain from reaching native code.
jest.mock('#/storage/keychain', () => ({
  loadSessionTokens: jest.fn(() => Promise.resolve(null)),
  saveSessionTokens: jest.fn(() => Promise.resolve()),
  clearSessionTokens: jest.fn(() => Promise.resolve()),
}));

// Mock store
let mockUser: { id: string; email: string } | null = {
  id: 'u1',
  email: 'test@test.com',
};
const mockSetUserNavigationState = jest.fn();
const mockGetUserNavigationState = jest.fn();

jest.mock('#store/useAppStore', () => {
  const getState = (): Partial<RootState> => ({
    user: mockUser as RootState['user'],
    setUserNavigationState: mockSetUserNavigationState,
    getUserNavigationState: mockGetUserNavigationState,
  });
  return {
    useAppStore: (selector: (state: RootState) => unknown) =>
      selector(getState() as RootState),
    useUser: () => getState().user,
    useUserId: () => getState().user?.id,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' };
  mockGetUserNavigationState.mockReturnValue(null);
});

describe('useBiometricPrompting', () => {
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
});
