import { useCallback, useState } from 'react';
import { useStore } from '#store';
import {
  useLoginMutation,
  useRegisterMutation,
  LoginInput,
  RegisterInput,
} from '#generated';
import {
  loadCredentials,
  saveCredentials,
  hasCredentials,
  clearCredentials,
} from '#/storage/keychain';

interface Credentials {
  email: string;
  password: string;
}

export const useAuth = () => {
  // Auth state from store
  const user = useStore(state => state.user);
  const accessToken = useStore(state => state.accessToken);
  const refreshToken = useStore(state => state.refreshToken);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const setAuth = useStore(state => state.setAuth);
  const clearAuth = useStore(state => state.clearAuth);
  const setTokens = useStore(state => state.setTokens);
  const updateUser = useStore(state => state.updateUser);
  const setEmailVerified = useStore(state => state.setEmailVerified);
  const setOnboarded = useStore(state => state.setOnboarded);
  const setRememberMe = useStore(state => state.setRememberMe);
  const setUserNavigationState = useStore(state => state.setUserNavigationState);

  // Local state for auth operations
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCredentials, setIsLoadingCredentials] = useState(false);

  // GraphQL mutations
  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

  // Computed properties
  const isAuthenticated = !!(user && accessToken);
  const hasAnyToken = !!(accessToken || refreshToken);
  const isLoggedOut = !user && !accessToken && !refreshToken;
  const isTokenRefreshing = !accessToken && !!refreshToken;
  const canAttemptQueries = hasAnyToken && !isLoggingOut;

  // Credential management
  const checkStoredCredentials = useCallback(async (): Promise<boolean> => {
    try {
      return await hasCredentials();
    } catch (error) {
      console.error('Error checking credentials:', error);
      return false;
    }
  }, []);

  const loadStoredCredentials = useCallback(async (): Promise<Credentials | null> => {
    try {
      setIsLoadingCredentials(true);
      const hasCreds = await hasCredentials();
      if (!hasCreds) return null;

      const credentials = await loadCredentials();
      return credentials ? {
        email: credentials.username,
        password: credentials.password,
      } : null;
    } catch (error) {
      console.error('Error loading credentials:', error);
      return null;
    } finally {
      setIsLoadingCredentials(false);
    }
  }, []);

  const storeCredentials = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      await saveCredentials(email, password);
      return true;
    } catch (error) {
      console.error('Error storing credentials:', error);
      return false;
    }
  }, []);

  const removeCredentials = useCallback(async (): Promise<boolean> => {
    try {
      await clearCredentials();
      return true;
    } catch (error) {
      console.error('Error removing credentials:', error);
      return false;
    }
  }, []);

  // Auth flow handlers
  const handleAuthSuccess = useCallback((message: string) => {
    console.log('Auth success:', message);
  }, []);

  const handleAuthError = useCallback((error: any, message?: string) => {
    console.error('Auth error:', message || error.message || error);
    setIsLoading(false);
  }, []);

  const handleLogin = useCallback(async (loginResponse: any, rememberMe?: boolean) => {
    if (!loginResponse?.user) return;

    const { user, accessToken, refreshToken } = loginResponse;

    if (rememberMe !== undefined) {
      setRememberMe(rememberMe);
    }

    if (user.id) {
      setUserNavigationState(user.id, {
        lastLoginTimestamp: Date.now(),
        rememberMeChoice: rememberMe,
      });
    }

    setAuth(user, accessToken, refreshToken);
    handleAuthSuccess('Login successful');
  }, [setAuth, setRememberMe, setUserNavigationState, handleAuthSuccess]);

  const handleRegistration = useCallback(async (registerResponse: any, rememberMe?: boolean) => {
    if (!registerResponse?.user) return;

    const { user, accessToken, refreshToken } = registerResponse;

    if (rememberMe !== undefined) {
      setRememberMe(rememberMe);
    }

    if (user.id) {
      setUserNavigationState(user.id, {
        lastLoginTimestamp: Date.now(),
        rememberMeChoice: rememberMe,
        isNewUser: true,
      });
    }

    setAuth(user, accessToken, refreshToken);
    handleAuthSuccess('Registration successful');
  }, [setAuth, setRememberMe, setUserNavigationState, handleAuthSuccess]);

  // Auth mutations
  const login = useCallback(async (input: LoginInput, rememberMe = false): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await loginMutation({ variables: { input } });

      if (result.data?.login) {
        await handleLogin(result.data.login, rememberMe);

        if (rememberMe) {
          await storeCredentials(input.email, input.password);
        }

        return true;
      }
      return false;
    } catch (error) {
      handleAuthError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [loginMutation, handleLogin, storeCredentials, handleAuthError]);

  const register = useCallback(async (input: RegisterInput, rememberMe = false): Promise<boolean> => {
    try {
      setIsLoading(true);
      const result = await registerMutation({ variables: { input } });

      if (result.data?.register) {
        await handleRegistration(result.data.register, rememberMe);

        if (rememberMe) {
          await storeCredentials(input.email, input.password);
        }

        return true;
      }
      return false;
    } catch (error) {
      handleAuthError(error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [registerMutation, handleRegistration, storeCredentials, handleAuthError]);

  const logout = useCallback(async () => {
    try {
      clearAuth();
      await removeCredentials();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [clearAuth, removeCredentials]);

  return {
    // State
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoggingOut,
    hasAnyToken,
    isLoggedOut,
    isTokenRefreshing,
    canAttemptQueries,
    isLoading,
    isLoadingCredentials,

    // Actions
    login,
    register,
    logout,
    setAuth,
    clearAuth,
    setTokens,
    updateUser,
    setEmailVerified,
    setOnboarded,

    // Credential management
    checkStoredCredentials,
    loadStoredCredentials,
    storeCredentials,
    removeCredentials,

    // Handlers
    handleLogin,
    handleRegistration,
    handleAuthSuccess,
    handleAuthError,
  };
};