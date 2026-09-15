import { renderHook, act } from '@testing-library/react-native';
import { useAuthNavigation } from '../useAuthNavigation';
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useAuthNavigation', () => {
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
  });
});
