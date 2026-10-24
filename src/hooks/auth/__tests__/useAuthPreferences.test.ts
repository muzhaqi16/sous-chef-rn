import { renderHook, act } from '@testing-library/react-native';
import type { RootState } from '#store';
import { useAuthPreferences } from '../useAuthPreferences';

type MockUser = RootState['user'];
type MockStoreState = {
  user: MockUser;
  setUserNavigationState: RootState['setUserNavigationState'];
};

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
    it('clears the decline flags for the current user', () => {
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markBiometricEnabled();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricDeclinedPermanently: false,
      });
    });
  });

  describe('markCredentialPromptDeclined', () => {
    it('records that the credential prompt was declined', () => {
      const { result } = renderHook(() => useAuthPreferences());

      act(() => {
        result.current.markCredentialPromptDeclined();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        credentialPromptDeclined: true,
      });
    });
  });
});
