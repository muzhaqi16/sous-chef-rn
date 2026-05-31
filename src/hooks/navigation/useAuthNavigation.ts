import { useAppStore } from '#store/useAppStore';
import { useStore } from '#store';
import { useAppNavigation } from './useAppNavigation';
import type { AuthUserInput } from '#store/slices/authSlice';

/** Auth response payload accepted by the login/registration handlers. */
interface AuthData {
  user: AuthUserInput | null;
  accessToken: string;
  refreshToken: string;
}

export function useAuthNavigation() {
  const { toLogin, toSignUp, toForgotPassword } = useAppNavigation();
  const setAuth = useAppStore(state => state.setAuth);
  const setRememberMe = useAppStore(state => state.setRememberMe);
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );

  const handleSuccessfulLogin = (authData: AuthData, rememberMe?: boolean) => {
    const { user, accessToken, refreshToken } = authData;
    // Save preferences
    if (rememberMe !== undefined) {
      setRememberMe(rememberMe);
    }
    // Track login
    if (user?.id) {
      setUserNavigationState(user.id, {
        lastLoginTimestamp: Date.now(),
        rememberMeChoice: rememberMe,
      });
    }
    // Update auth state - navigation happens automatically
    if (user) {
      setAuth(user, accessToken, refreshToken);
    }
  };

  const handleSuccessfulRegistration = (
    authData: AuthData,
    rememberMe?: boolean,
  ) => {
    const { user, accessToken, refreshToken } = authData;
    // Save preferences
    if (rememberMe !== undefined) {
      setRememberMe(rememberMe);
    }
    // Mark as new user
    if (user?.id) {
      setUserNavigationState(user.id, {
        lastLoginTimestamp: Date.now(),
        rememberMeChoice: rememberMe,
        isNewUser: true,
      });
    }
    // Update auth state - navigation happens automatically
    if (user) {
      setAuth(user, accessToken, refreshToken);
    }
  };

  const handleLogout = async () => {
    // Use the store's logout method which handles everything
    const logout = useStore.getState().logout;
    await logout();
    // Navigation to auth screen happens automatically
  };

  // These are for navigating within the auth stack only
  const navigateToVerification = () => {
    // This is actually handled by conditional navigation now
    // When user.emailVerified is false, it automatically shows verification
    console.log('Verification navigation handled by conditional groups');
  };

  const navigateToForgotPassword = toForgotPassword;
  const navigateToLogin = toLogin;
  const navigateToSignUp = toSignUp;

  return {
    handleSuccessfulLogin,
    handleSuccessfulRegistration,
    handleLogout,
    navigateToVerification,
    navigateToForgotPassword,
    navigateToLogin,
    navigateToSignUp,
  };
}
