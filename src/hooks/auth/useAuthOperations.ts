import { useCallback, useState } from 'react';
import { useToast } from '#/hooks/useToast';
import {
  useLoginMutation,
  useRegisterMutation,
  LoginInput,
  RegisterInput,
} from '#generated';
import { logger } from '#/utils/environment';
import { useErrorHandler } from '#/utils/errorHandling';
import { useDeviceRegistration } from '#/hooks/useDeviceRegistration';
import { useUserPreferences } from '#/hooks/navigation/useUserPreferences';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { LogoutCleanup } from '#/apollo/logoutCleanup';
import { useStore } from '#store';

// Simple credential representation - doesn't know about internal storage structure
export interface LoginCredentials {
  email: string;
  password: string;
}

// Events interface for credential storage operations
export interface CredentialStorageEvents {
  onCredentialCheck: (email?: string) => Promise<boolean>;
  onCredentialLoad: (email?: string) => Promise<LoginCredentials | null>;
  onCredentialStore: (email: string, password: string) => Promise<boolean>;
  onCredentialRemove: (email?: string) => Promise<boolean>;
}

// Events interface for RememberMe flow
export interface RememberMeEvents {
  onShowRememberMe: (credentials: LoginCredentials) => void;
}

// Events interface for biometric setup flow
export interface BiometricSetupEvents {
  onShowBiometricSetup: (credentials: LoginCredentials) => void;
}

// Events interface for navigation
export interface NavigationEvents {
  onNavigate: (state: any) => void;
}

// Events interface for auth state
export interface AuthStateEvents {
  onSetAuth: (user: any, accessToken: string, refreshToken: string) => void;
  onClearAuth: () => void;
  onSetRememberMe: (flag: boolean) => void;
  onSetUserNavigationState: (userId: string, state: any) => void;
  onSetRegistrationPassword: (password: string | null) => void;
  onClearRegistrationPassword: () => void;
}

interface AuthOperationsProps {
  credentialStorage: CredentialStorageEvents;
  rememberMe: RememberMeEvents;
  biometricSetup: BiometricSetupEvents;
  navigation: NavigationEvents;
  authState: AuthStateEvents;
  shouldShowPostLoginBiometricPrompt: (user: {
    id: string;
    email: string;
  }) => Promise<{ shouldShow: boolean; reason?: string }>;
}

/**
 * Hook for managing authentication operations (login, register, logout).
 * This hook coordinates auth flows by emitting events to other hooks.
 * It doesn't know HOW things are stored or HOW navigation works - just WHAT needs to happen.
 */
export const useAuthOperations = ({
  credentialStorage,
  rememberMe,
  biometricSetup,
  navigation,
  authState,
  shouldShowPostLoginBiometricPrompt,
}: AuthOperationsProps) => {
  // Local state for auth operations
  const [isLoading, setIsLoading] = useState(false);
  const [isInRegistrationFlow, setIsInRegistrationFlow] = useState(false);

  // Dependencies
  const toast = useToast();
  const { handleApolloError } = useErrorHandler();
  const { registerDeviceInBackground } = useDeviceRegistration();
  const {
    shouldShowCredentialPrompt,
    clearRegistrationPreferences,
    trackCredentialPromptShown,
    trackLogout,
  } = useUserPreferences();

  // GraphQL mutations
  const [loginMutation] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

  // Auth flow handlers
  const handleAuthSuccess = useCallback((message: string) => {
    logger.info('Auth success:', message);
  }, []);

  const handleAuthError = useCallback(
    (error: any, operation: string = 'Authentication') => {
      try {
        const { message, code, isAuthError } = handleApolloError(error, {
          operation,
          logError: true,
        });

        // Show user-friendly error message
        toast({
          message,
          type: 'error',
        });

        // Additional handling for specific auth errors
        if (
          isAuthError &&
          (code === 'AUTH_TOKEN_EXPIRED' ||
            code === 'AUTH_REFRESH_TOKEN_INVALID')
        ) {
          // Clear auth state for expired tokens
          authState.onClearAuth();
        }

        setIsLoading(false);
      } catch {
        // Fallback error handling - show generic message
        toast({
          message: 'Login failed. Please check your credentials and try again.',
          type: 'error',
        });

        setIsLoading(false);
      }
    },
    [toast, handleApolloError, authState],
  );

  const handleLogin = useCallback(
    async (
      loginResponse: any,
      shouldRemember?: boolean,
      loginCredentials?: LoginCredentials,
    ) => {
      if (!loginResponse?.user) {
        return;
      }

      const { user, accessToken, refreshToken } = loginResponse;

      // Get previous user ID from queue store to detect user changes
      const previousUserId = queueStore.getCurrentUserId();

      // Set auth state first
      authState.onSetAuth(user, accessToken, refreshToken);

      // Notify queue manager about user change
      // This will clear the previous user's queue if it's a different user
      queueManager.onUserChange(user.id, previousUserId);

      // Pre-populate Zustand store with bootstrap IDs from login response.
      // This eliminates the GetHomes → GetPantry waterfall by letting
      // pantry and shopping list queries fire immediately in parallel.
      const storeState = useStore.getState();
      if (user.defaultHomeId) {
        // Derive default pantry ID from the defaultHome's pantries
        const pantries = user.defaultHome?.pantriesConnection?.edges;
        const defaultPantry =
          pantries?.find((e: any) => e.node.isDefault)?.node ??
          pantries?.[0]?.node;
        const pantryId = defaultPantry?.id ?? null;

        storeState.setHomeAndPantry(user.defaultHomeId, pantryId);
        if (pantryId) {
          storeState.setIsHomeSelectionReady(true);
        }
      }
      if (user.defaultShoppingListId) {
        storeState.setSelectedShoppingListId(user.defaultShoppingListId);
      }

      if (shouldRemember !== undefined) {
        authState.onSetRememberMe(shouldRemember);
      }

      if (user.id) {
        authState.onSetUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
          rememberMeChoice: shouldRemember,
        });
      }

      handleAuthSuccess('Login successful');
      registerDeviceInBackground();

      // **EXPLICIT NAVIGATION FLOW CONTROL**
      if (!user.emailVerified) {
        navigation.onNavigate('verification');
        return;
      }

      if (!user.onBoarded) {
        navigation.onNavigate('onboarding');
        return;
      }

      // User is fully authenticated - check biometric setup eligibility
      // BUT skip during registration flow, email verification, or onboarding to prevent unwanted biometric prompts
      if (
        loginCredentials &&
        !isInRegistrationFlow &&
        user.emailVerified &&
        user.onBoarded
      ) {
        try {
          const result = await shouldShowPostLoginBiometricPrompt({
            id: user.id,
            email: loginCredentials.email,
          });

          if (result.shouldShow) {
            biometricSetup.onShowBiometricSetup(loginCredentials);
            return;
          }
        } catch (error) {
          console.error('Error checking biometric eligibility:', error);
        }
      }

      // Default: navigate to main app
      navigation.onNavigate('main_app');
    },
    [
      authState,
      handleAuthSuccess,
      registerDeviceInBackground,
      shouldShowPostLoginBiometricPrompt,
      navigation,
      biometricSetup,
      isInRegistrationFlow,
    ],
  );

  const handleRegistration = useCallback(
    async (registerResponse: any, shouldRemember?: boolean) => {
      if (!registerResponse?.user) return;

      const { user, accessToken, refreshToken } = registerResponse;

      // Set auth state first
      authState.onSetAuth(user, accessToken, refreshToken);

      // Pre-populate bootstrap IDs if available (same as handleLogin)
      const regStoreState = useStore.getState();
      if (user.defaultHomeId) {
        const pantries = user.defaultHome?.pantriesConnection?.edges;
        const defaultPantry =
          pantries?.find((e: any) => e.node.isDefault)?.node ??
          pantries?.[0]?.node;
        const pantryId = defaultPantry?.id ?? null;

        regStoreState.setHomeAndPantry(user.defaultHomeId, pantryId);
        if (pantryId) {
          regStoreState.setIsHomeSelectionReady(true);
        }
      }
      if (user.defaultShoppingListId) {
        regStoreState.setSelectedShoppingListId(user.defaultShoppingListId);
      }

      if (shouldRemember !== undefined) {
        authState.onSetRememberMe(shouldRemember);
      }

      if (user.id) {
        authState.onSetUserNavigationState(user.id, {
          lastLoginTimestamp: Date.now(),
          rememberMeChoice: shouldRemember,
          isNewUser: true,
        });
      }

      handleAuthSuccess('Registration successful');
      registerDeviceInBackground();

      // **EXPLICIT NAVIGATION FLOW CONTROL FOR NEW USERS**
      // Skip biometric setup during registration - let onboarding handle it
      if (!user.emailVerified) {
        navigation.onNavigate('verification');
        return;
      }

      if (!user.onBoarded) {
        navigation.onNavigate('onboarding');
        return;
      }

      // If somehow user is already onboarded, go to main app
      navigation.onNavigate('main_app');
    },
    [authState, handleAuthSuccess, registerDeviceInBackground, navigation],
  );

  // Auto-login functionality
  const autoLogin = useCallback(async (): Promise<boolean> => {
    try {
      // Check if we have stored credentials
      const hasStoredCreds = await credentialStorage.onCredentialCheck();

      if (!hasStoredCreds) {
        logger.info('No stored credentials found for auto-login');
        return false;
      }

      // Load stored credentials
      const credentials = await credentialStorage.onCredentialLoad();

      if (!credentials) {
        logger.info('Failed to load stored credentials');
        return false;
      }

      // Additional validation - ensure credentials are not empty
      if (!credentials.email || !credentials.password) {
        logger.warn('Invalid credentials found, clearing them');
        await credentialStorage.onCredentialRemove();
        return false;
      }

      // Attempt login with stored credentials
      logger.info('Attempting auto-login with stored credentials');
      const result = await loginMutation({
        variables: {
          input: {
            email: credentials.email,
            password: credentials.password,
          },
        },
      });

      if (result.data?.login) {
        await handleLogin(result.data.login, true);
        logger.info('Auto-login successful');
        return true;
      }

      // If login failed, clear bad credentials
      if (result.error) {
        logger.warn('Auto-login failed, clearing stored credentials');
        await credentialStorage.onCredentialRemove();
        handleAuthError(result.error, 'Auto-login');
      }

      return false;
    } catch (error) {
      // Log but don't show error to user for auto-login
      logger.error('Auto-login error:', error);

      // Clear potentially corrupted credentials
      try {
        await credentialStorage.onCredentialRemove();
      } catch (cleanupError) {
        logger.error(
          'Failed to cleanup credentials after auto-login error:',
          cleanupError,
        );
      }

      return false;
    }
  }, [credentialStorage, loginMutation, handleLogin, handleAuthError]);

  // Auth mutations
  const login = useCallback(
    async (input: LoginInput, showRememberPrompt = true): Promise<boolean> => {
      try {
        setIsLoading(true);
        const result = await loginMutation({ variables: { input } });

        if (result.data?.login) {
          const loginCredentials = {
            email: input.email,
            password: input.password,
          };

          // Handle login success first
          await handleLogin(result.data.login, true, loginCredentials);

          // Show credential storage prompt as fallback if showRememberPrompt and no biometric prompt shown
          if (showRememberPrompt) {
            const hasStoredCreds = await credentialStorage.onCredentialCheck(
              input.email,
            );
            if (!hasStoredCreds && shouldShowCredentialPrompt()) {
              rememberMe.onShowRememberMe(loginCredentials);
              trackCredentialPromptShown();
            }
          }

          return true;
        }

        // Check for GraphQL errors in result
        if (result.error) {
          handleAuthError(result.error);
          return false;
        }

        return false;
      } catch (error) {
        handleAuthError(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      loginMutation,
      handleLogin,
      handleAuthError,
      credentialStorage,
      shouldShowCredentialPrompt,
      trackCredentialPromptShown,
      rememberMe,
    ],
  );

  const register = useCallback(
    async (input: RegisterInput, shouldRemember = true): Promise<boolean> => {
      try {
        setIsLoading(true);
        setIsInRegistrationFlow(true); // Mark as registration flow to prevent biometric prompts
        const result = await registerMutation({ variables: { input } });

        if (result.data?.register) {
          // Store password temporarily for onboarding biometric setup
          authState.onSetRegistrationPassword(input.password);

          // Clear any previous credential declination state since this is a new user
          if (result.data.register.user?.id) {
            clearRegistrationPreferences(result.data.register.user.id);
          }

          // Handle registration - credentials will be stored later during biometric setup if user chooses
          await handleRegistration(result.data.register, shouldRemember);

          return true;
        }

        // Check for GraphQL errors in result
        if (result.error) {
          handleAuthError(result.error, 'Register');
          return false;
        }

        return false;
      } catch (error) {
        handleAuthError(error, 'Register');
        return false;
      } finally {
        setIsLoading(false);
        setIsInRegistrationFlow(false); // Clear registration flow flag
      }
    },
    [
      registerMutation,
      handleRegistration,
      handleAuthError,
      clearRegistrationPreferences,
      authState,
    ],
  );

  const logout = useCallback(
    async (user: any, clearAllCredentials = false) => {
      try {
        const currentUserEmail = user?.email;
        const currentUserId = user?.id;

        // Perform comprehensive Apollo cleanup (includes cancelTokenRefresh)
        await LogoutCleanup.performLogoutCleanup();

        // Notify queue manager about logout (clears queue for this user)
        if (currentUserId) {
          queueManager.onLogout(currentUserId);
        }

        // Clear auth state (this also calls cancelTokenRefresh as a safety net)
        authState.onClearAuth();

        // Complete logout process and reset flags
        LogoutCleanup.completeLogout();

        // Reset navigation state to auth after logout
        navigation.onNavigate('auth');

        // Clean up navigation state for the current user
        if (currentUserId) {
          trackLogout(currentUserId);
        }

        // Handle credential removal
        if (clearAllCredentials) {
          // Clear all stored credentials
          await credentialStorage.onCredentialRemove();
        } else if (currentUserEmail) {
          // Only clear credentials for current user, keep others for account switching
          await credentialStorage.onCredentialRemove(currentUserEmail);
        }
      } catch (error) {
        logger.error('Logout error:', error);
      }
    },
    [authState, credentialStorage, trackLogout, navigation],
  );

  const clearRegistrationPassword = useCallback(() => {
    authState.onClearRegistrationPassword();
  }, [authState]);

  return {
    // State
    isLoading,

    // Core operations
    login,
    register,
    logout,
    autoLogin,

    // Handlers
    handleLogin,
    handleRegistration,
    handleAuthSuccess,
    handleAuthError,

    // Registration password management
    clearRegistrationPassword,
  };
};
