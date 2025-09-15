import {useNavigation} from '@react-navigation/native'; // Use the hook instead
import {useCallback} from 'react';
import {useStore} from '#store';

export function useAuthNavigation() {
  const navigation = useNavigation(); // Get navigation from the hook
  const {setAuth, setRememberMe, setUserNavigationState} = useStore();

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
    const store = useStore.getState();
    await store.logout();
    // Navigation to auth screen happens automatically
  }, []);

  // These are for navigating within the auth stack only
  const navigateToVerification = useCallback(() => {
    // This is actually handled by conditional navigation now
    // When user.emailVerified is false, it automatically shows verification
    console.log('Verification navigation handled by conditional groups');
  }, []);

  const navigateToForgotPassword = useCallback(() => {
    // Use the navigation from the hook
    navigation.navigate('ForgotPassword' as never);
  }, [navigation]);

  const navigateToLogin = useCallback(() => {
    navigation.navigate('Login' as never);
  }, [navigation]);

  const navigateToSignUp = useCallback(() => {
    navigation.navigate('SignUp' as never);
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
