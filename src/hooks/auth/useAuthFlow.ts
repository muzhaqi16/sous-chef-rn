import {useCallback, useState} from 'react';
import {useStore} from '#store';
import {
  useLoginMutation,
  useRegisterMutation,
  LoginInput,
  RegisterInput,
} from '#generated';
import {useCredentialManager} from './useCredentialManager';
import {useAuthErrorHandler} from './useAuthErrorHandler';

export const useAuthFlow = () => {
  const {
    setAuth,
    setRememberMe,
    setUserNavigationState,
    getUserNavigationState,
  } = useStore();

  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();
  const {storeCredentials, removeCredentials} = useCredentialManager();
  const {handleAuthError, handleAuthSuccess} = useAuthErrorHandler();

  const [isLoading, setIsLoading] = useState(false);

  // Handle login - just manages auth state
  const handleLogin = useCallback(
    async (loginResponse: any, rememberMe?: boolean) => {
      if (!loginResponse?.user) return;

      const {user, accessToken, refreshToken} = loginResponse;

      // Save remember me preference
      if (rememberMe !== undefined) {
        setRememberMe(rememberMe);
      }

      // Track login in user navigation state
      if (user.id) {
        setUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
          rememberMeChoice: rememberMe,
        });
      }

      // Update auth state - navigation happens automatically
      setAuth(user, accessToken, refreshToken);

      handleAuthSuccess('Login successful');
    },
    [setAuth, setRememberMe, setUserNavigationState, handleAuthSuccess],
  );

  // Handle registration - just manages auth state
  const handleRegistration = useCallback(
    async (registerResponse: any, rememberMe?: boolean) => {
      if (!registerResponse?.user) return;

      const {user, accessToken, refreshToken} = registerResponse;

      // Save remember me preference
      if (rememberMe !== undefined) {
        setRememberMe(rememberMe);
      }

      // Mark as new user in navigation state
      if (user.id) {
        setUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
          rememberMeChoice: rememberMe,
          isNewUser: true,
        });
      }

      // Update auth state - navigation happens automatically
      setAuth(user, accessToken, refreshToken);

      handleAuthSuccess('Registration successful');
    },
    [setAuth, setRememberMe, setUserNavigationState, handleAuthSuccess],
  );

  // Direct login method (for login screen)
  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = false) => {
      setIsLoading(true);

      try {
        const response = await loginMutation({
          variables: {
            input: {email, password} as LoginInput,
          },
        });

        if (response.data?.login) {
          const loginData = response.data.login;

          // Store credentials if remember me
          if (rememberMe) {
            await storeCredentials(email, password);
          } else {
            await removeCredentials();
          }

          // Use handleLogin to update state
          await handleLogin(loginData, rememberMe);

          return {success: true, user: loginData.user};
        }

        throw new Error('Login failed');
      } catch (error: any) {
        handleAuthError(error, 'Login failed');
        return {success: false, error: error.message};
      } finally {
        setIsLoading(false);
      }
    },
    [
      loginMutation,
      handleLogin,
      storeCredentials,
      removeCredentials,
      handleAuthError,
    ],
  );

  // Direct register method (for signup screen)
  const register = useCallback(
    async (
      email: string,
      password: string,
      name: string, // Changed from firstName/lastName to match your forms
    ) => {
      setIsLoading(true);

      try {
        const response = await registerMutation({
          variables: {
            input: {
              email,
              password,
              name, // Your backend expects 'name' not firstName/lastName
            } as RegisterInput,
          },
        });

        if (response.data?.register) {
          const registerData = response.data.register;

          // Use handleRegistration to update state
          await handleRegistration(registerData, false); // Don't auto-remember on registration

          return {
            success: true,
            user: registerData.user,
            needsVerification: !registerData.user.emailVerified,
          };
        }

        throw new Error('Registration failed');
      } catch (error: any) {
        handleAuthError(error, 'Registration failed');
        return {success: false, error: error.message};
      } finally {
        setIsLoading(false);
      }
    },
    [registerMutation, handleRegistration, handleAuthError],
  );

  // Logout using store's reset manager
  const logout = useCallback(async () => {
    const store = useStore.getState();

    try {
      // Use the store's logout method which handles everything
      await store.logout();

      // Clear stored credentials
      await removeCredentials();

      handleAuthSuccess('Logged out successfully');
    } catch (error: any) {
      handleAuthError(error, 'Logout failed');
    }
  }, [removeCredentials, handleAuthSuccess, handleAuthError]);

  return {
    handleLogin, // For when you already have auth response
    handleRegistration, // For when you already have auth response
    login, // Direct login method
    register, // Direct register method
    logout,
    isLoading,
  };
};
