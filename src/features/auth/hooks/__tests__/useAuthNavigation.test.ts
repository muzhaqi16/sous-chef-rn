import { renderHook, act } from '@testing-library/react-native';
import { useAuthNavigation } from '../useAuthNavigation';
import { logger } from '#/utils/environment';
import type { AuthUserInput } from '#store/slices/authSlice';

function makeUser(overrides?: Partial<AuthUserInput>): AuthUserInput {
  return {
    id: 'u1',
    email: 'user@example.com',
    emailVerified: true,
    onBoarded: true,
    ...overrides,
  };
}

// Break circular dependency chain
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockToLogin = jest.fn();
const mockToSignUp = jest.fn();
const mockToForgotPassword = jest.fn();

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    toLogin: mockToLogin,
    toSignUp: mockToSignUp,
    toForgotPassword: mockToForgotPassword,
  }),
}));

const mockSetAuth = jest.fn();
const mockSetRememberMe = jest.fn();
const mockSetUserNavigationState = jest.fn();

jest.mock('#store/useAppStore', () => ({
  useAppStore: (
    selector: (state: {
      setAuth: typeof mockSetAuth;
      setRememberMe: typeof mockSetRememberMe;
      setUserNavigationState: typeof mockSetUserNavigationState;
    }) => unknown,
  ) =>
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
          user: makeUser(),
          accessToken: 'at',
          refreshToken: 'rt',
        });
      });

      expect(mockSetAuth).toHaveBeenCalledWith(makeUser(), 'at', 'rt');
    });

    it('sets rememberMe when provided', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin(
          { user: makeUser(), accessToken: 'at', refreshToken: 'rt' },
          true,
        );
      });

      expect(mockSetRememberMe).toHaveBeenCalledWith(true);
    });

    it('does not set rememberMe when undefined', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulLogin({
          user: makeUser(),
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
          { user: makeUser(), accessToken: 'at', refreshToken: 'rt' },
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
          user: makeUser({ id: 'u2' }),
          accessToken: 'at2',
          refreshToken: 'rt2',
        });
      });

      expect(mockSetAuth).toHaveBeenCalledWith(
        makeUser({ id: 'u2' }),
        'at2',
        'rt2',
      );
    });

    it('marks user as new user in navigation state', () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.handleSuccessfulRegistration(
          {
            user: makeUser({ id: 'u2' }),
            accessToken: 'at2',
            refreshToken: 'rt2',
          },
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
          {
            user: makeUser({ id: 'u2' }),
            accessToken: 'at2',
            refreshToken: 'rt2',
          },
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
    it('navigateToForgotPassword delegates to facade toForgotPassword', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToForgotPassword();
      });

      expect(mockToForgotPassword).toHaveBeenCalledTimes(1);
    });

    it('navigateToLogin delegates to facade toLogin', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToLogin();
      });

      expect(mockToLogin).toHaveBeenCalledTimes(1);
    });

    it('navigateToSignUp delegates to facade toSignUp', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToSignUp();
      });

      expect(mockToSignUp).toHaveBeenCalledTimes(1);
    });

    it('navigateToVerification logs a message (handled by conditional groups)', () => {
      const { result } = renderHook(() => useAuthNavigation());

      act(() => {
        result.current.navigateToVerification();
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'Verification navigation handled by conditional groups',
      );
    });
  });
});
