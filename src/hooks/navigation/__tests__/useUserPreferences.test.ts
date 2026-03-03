import { renderHook, act } from '@testing-library/react-native';
import { useUserPreferences } from '../useUserPreferences';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const mockSetUserNavigationState = jest.fn();
const mockGetUserNavigationState = jest.fn();

let mockUser: any = { id: 'u1', email: 'test@test.com' };

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      user: mockUser,
      getUserNavigationState: mockGetUserNavigationState,
      setUserNavigationState: mockSetUserNavigationState,
    }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'u1', email: 'test@test.com' };
  mockGetUserNavigationState.mockReturnValue(null);
});

describe('useUserPreferences (navigation)', () => {
  describe('shouldShowCredentialPrompt', () => {
    it('returns true when no navigation state exists for user', () => {
      mockGetUserNavigationState.mockReturnValue(null);
      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.shouldShowCredentialPrompt()).toBe(true);
    });

    it('returns true when credentialPromptDeclined is false', () => {
      mockGetUserNavigationState.mockReturnValue({ credentialPromptDeclined: false });
      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.shouldShowCredentialPrompt()).toBe(true);
    });

    it('returns false when credentialPromptDeclined is true', () => {
      mockGetUserNavigationState.mockReturnValue({ credentialPromptDeclined: true });
      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.shouldShowCredentialPrompt()).toBe(false);
    });

    it('returns false when no user and no userId provided', () => {
      mockUser = null;
      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.shouldShowCredentialPrompt()).toBe(false);
    });

    it('uses provided userId over current user', () => {
      mockGetUserNavigationState.mockReturnValue({ credentialPromptDeclined: true });
      const { result } = renderHook(() => useUserPreferences());

      result.current.shouldShowCredentialPrompt('other-user');

      expect(mockGetUserNavigationState).toHaveBeenCalledWith('other-user');
    });
  });

  describe('markBiometricDeclined', () => {
    it('sets biometricDeclinedPermanently for current user', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.markBiometricDeclined();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricDeclinedPermanently: true,
      });
    });

    it('uses provided userId', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.markBiometricDeclined('u2');
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u2', {
        biometricDeclinedPermanently: true,
      });
    });

    it('does nothing when no user and no userId', () => {
      mockUser = null;
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.markBiometricDeclined();
      });

      expect(mockSetUserNavigationState).not.toHaveBeenCalled();
    });
  });

  describe('markBiometricEnabled', () => {
    it('sets biometric enabled flags for current user', () => {
      const { result } = renderHook(() => useUserPreferences());

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

      const { result } = renderHook(() => useUserPreferences());

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
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.resetBiometricDeclination();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricDeclinedPermanently: false,
      });
    });
  });

  describe('resetAllPreferences', () => {
    it('resets both biometric and credential preferences', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.resetAllPreferences();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricDeclinedPermanently: false,
        credentialPromptDeclined: false,
      });
    });
  });

  describe('trackCredentialPromptShown', () => {
    it('records the timestamp of the credential prompt', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.trackCredentialPromptShown();
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        lastCredentialPromptShown: now,
      });

      jest.restoreAllMocks();
    });
  });

  describe('clearRegistrationPreferences', () => {
    it('clears credential and biometric preferences for the given userId', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.clearRegistrationPreferences('u3');
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u3', {
        credentialPromptDeclined: false,
        biometricDeclinedPermanently: false,
      });
    });
  });

  describe('trackLogout', () => {
    it('sets biometricEnabled to false for the given userId', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.trackLogout('u1');
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        biometricEnabled: false,
      });
    });
  });
});
