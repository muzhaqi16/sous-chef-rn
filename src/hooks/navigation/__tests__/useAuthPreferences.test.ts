import { renderHook, act } from '@testing-library/react-native';
import type { RootState } from '#store';
import { useAuthPreferences } from '../useAuthPreferences';

type MockUser = RootState['user'];
type MockStoreState = {
  user: MockUser;
  setUserNavigationState: RootState['setUserNavigationState'];
};

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockSetUserNavigationState = jest.fn();

let mockUser: MockUser = { id: 'u1', email: 'test@test.com' } as MockUser;

jest.mock('#store/useAppStore', () => {
  const getState = (): MockStoreState => ({
    user: mockUser,
    setUserNavigationState: mockSetUserNavigationState,
  });
  return {
    useAppStore: (selector: (state: MockStoreState) => unknown) =>
      selector(getState()),
    useUser: () => getState().user,
    useUserId: () => getState().user?.id,
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' } as MockUser;
});

describe('useAuthPreferences', () => {
  describe('markBiometricDeclined', () => {
    it('sets biometricDeclinedPermanently for current user', () => {
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markBiometricDeclined();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricDeclinedPermanently: true,
      });
    });

    it('uses provided userId', () => {
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markBiometricDeclined('u2');
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u2', {
        biometricDeclinedPermanently: true,
      });
    });

    it('does nothing when no user and no userId', () => {
      mockUser = null;
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markBiometricDeclined();
      });

      expect(mockSetUserNavigationState).not.toHaveBeenCalled();
    });
  });

  describe('markBiometricEnabled', () => {
    it('sets biometric enabled flags for current user', () => {
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markBiometricEnabled();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricEnabled: true,
        biometricPromptRemindLater: false,
        lastBiometricPromptDeclined: undefined,
        biometricDeclinedPermanently: false,
      });
    });
  });

  describe('markCredentialPromptDeclined', () => {
    it('sets credentialPromptDeclined and timestamp', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markCredentialPromptDeclined();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        credentialPromptDeclined: true,
        lastCredentialPromptShown: now,
      });

      jest.restoreAllMocks();
    });
  });

  describe('resetBiometricDeclination', () => {
    it('resets biometricDeclinedPermanently to false', () => {
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.resetBiometricDeclination();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricDeclinedPermanently: false,
      });
    });
  });
});
