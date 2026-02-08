import {useNavigation, CommonActions} from '@react-navigation/native';
import {useCallback} from 'react';
import {useAppStore} from '#store/useAppStore';
import {useStore} from '#store';

export function useAuthNavigation() {
  const navigation = useNavigation();
  const setAuth = useAppStore(state => state.setAuth);
  const setRememberMe = useAppStore(state => state.setRememberMe);
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );

  const handleSuccessfulLogin = useCallback(
    (authData: any, rememberMe?: boolean) => {
      const {user, accessToken, refreshToken} = authData;
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
      setAuth(user, accessToken, refreshToken);
    },
    [setAuth, setRememberMe, setUserNavigationState],
  );

  const handleSuccessfulRegistration = useCallback(
    (authData: any, rememberMe?: boolean) => {
      const {user, accessToken, refreshToken} = authData;
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
      setAuth(user, accessToken, refreshToken);
    },
    [setAuth, setRememberMe, setUserNavigationState],
  );

  const handleLogout = useCallback(async () => {
    // Use the store's logout method which handles everything
    const logout = useStore.getState().logout;
    await logout();
    // Navigation to auth screen happens automatically
  }, []);

  // These are for navigating within the auth stack only
  const navigateToVerification = useCallback(() => {
    // This is actually handled by conditional navigation now
    // When user.emailVerified is false, it automatically shows verification
    console.log('Verification navigation handled by conditional groups');
  }, []);

  const navigateToForgotPassword = useCallback(() => {
    navigation.dispatch(CommonActions.navigate('ForgotPassword'));
  }, [navigation]);

  const navigateToLogin = useCallback(() => {
    navigation.dispatch(CommonActions.navigate('Login'));
  }, [navigation]);

  const navigateToSignUp = useCallback(() => {
    navigation.dispatch(CommonActions.navigate('SignUp'));
  }, [navigation]);

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
