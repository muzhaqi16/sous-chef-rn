import { renderHook, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { useAuthNavigation } from '../useAuthNavigation';

// Break circular dependency chain
jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

const mockDispatch = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
  };
});

const mockSetAuth = jest.fn();
const mockSetRememberMe = jest.fn();
const mockSetUserNavigationState = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (state: any) => any) =>
    selector({
      setAuth: mockSetAuth,
      setRememberMe: mockSetRememberMe,
      setUserNavigationState: mockSetUserNavigationState,
    }),
}));

const mockLogout = jest.fn().mockResolvedValue(undefined);
jest.mock('#store', () => ({
  useStore: {
    getState: () => ({
      logout: mockLogout,
    }),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAuthNavigation', () => {
  describe('handleSuccessfulLogin', () => {
    it('sets auth data from login response', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin({
          user: { id: 'u1' },
          accessToken: 'at',
          refreshToken: 'rt',
        });
      });

      expect(mockSetAuth).toHaveBeenCalledWith({ id: 'u1' }, 'at', 'rt');
    });

    it('sets rememberMe when provided', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin(
          { user: { id: 'u1' }, accessToken: 'at', refreshToken: 'rt' },
          true,
        );
      });

      expect(mockSetRememberMe).toHaveBeenCalledWith(true);
    });

    it('does not set rememberMe when undefined', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin({
          user: { id: 'u1' },
          accessToken: 'at',
          refreshToken: 'rt',
        });
      });

      expect(mockSetRememberMe).not.toHaveBeenCalled();
    });

    it('tracks login navigation state with timestamp', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin(
          { user: { id: 'u1' }, accessToken: 'at', refreshToken: 'rt' },
          true,
        );
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u1', {
        lastLoginTimestamp: now,
        rememberMeChoice: true,
      });

      jest.restoreAllMocks();
    });

    it('does not track navigation state when user has no id', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin({
          user: null,
          accessToken: 'at',
          refreshToken: 'rt',
        });
      });

      expect(mockSetUserNavigationState).not.toHaveBeenCalled();
    });
  });

  describe('handleSuccessfulRegistration', () => {
    it('sets auth data from registration response', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulRegistration({
          user: { id: 'u2' },
          accessToken: 'at2',
          refreshToken: 'rt2',
        });
      });

      expect(mockSetAuth).toHaveBeenCalledWith({ id: 'u2' }, 'at2', 'rt2');
    });

    it('marks user as new user in navigation state', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulRegistration(
          { user: { id: 'u2' }, accessToken: 'at2', refreshToken: 'rt2' },
          false,
        );
      });

      expect(mockSetUserNavigationState).toHaveBeenCalledWith('u2', {
        lastLoginTimestamp: now,
        rememberMeChoice: false,
        isNewUser: true,
      });

      jest.restoreAllMocks();
    });

    it('sets rememberMe for registration', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulRegistration(
          { user: { id: 'u2' }, accessToken: 'at2', refreshToken: 'rt2' },
          true,
        );
      });

      expect(mockSetRememberMe).toHaveBeenCalledWith(true);
    });
  });

  describe('handleLogout', () => {
    it('calls the store logout method', async () => {
      const { result } = renderHook(() => useAuthNavigation());

      await act(async () => {
        await result.current.handleLogout();
      });

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('auth stack navigation', () => {
    it('navigateToForgotPassword dispatches navigate to ForgotPassword', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToForgotPassword();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('ForgotPassword'),
      );
    });

    it('navigateToLogin dispatches navigate to Login', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToLogin();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('Login'),
      );
    });

    it('navigateToSignUp dispatches navigate to SignUp', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToSignUp();
      });

      expect(mockDispatch).toHaveBeenCalledWith(
        CommonActions.navigate('SignUp'),
      );
    });

    it('navigateToVerification logs a message (handled by conditional groups)', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToVerification();
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Verification navigation handled by conditional groups',
      );
      consoleSpy.mockRestore();
    });
  });
});
