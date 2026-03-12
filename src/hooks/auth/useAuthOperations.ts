import { useState } from 'react';
import { useToast } from '#/hooks/useToast';
import {
  useLoginMutation,
  useRegisterMutation,
  LoginInput,
  RegisterInput,
} from '#generated';
import { logger } from '#/utils/environment';
import { useErrorService } from '#/services/errorService';
import { useUserPreferences } from '#/hooks/navigation/useUserPreferences';
import {
  executeMutation,
  executeQuery,
} from '#/utils/compilerSafeWrappers';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import { LogoutCleanup } from '#/apollo/logoutCleanup';
import { useStore } from '#store';
import {
  saveTempRegistrationPassword,
  clearTempRegistrationPassword,
} from '#/storage/keychain';
import { incrementLoginCount } from '#/hooks/useFeatureHint';

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

export interface AuthOperationsReturn {
  isLoading: boolean;
  login: (input: LoginInput, showRememberPrompt?: boolean) => Promise<boolean>;
  register: (
    input: RegisterInput,
    shouldRemember?: boolean,
  ) => Promise<boolean>;
  logout: (user: any, clearAllCredentials?: boolean) => Promise<void>;
  autoLogin: () => Promise<boolean>;
  handleLogin: (
    loginResponse: any,
    shouldRemember?: boolean,
    loginCredentials?: LoginCredentials,
  ) => Promise<boolean>;
  handleRegistration: (
    registerResponse: any,
    shouldRemember?: boolean,
  ) => Promise<void>;
  handleAuthSuccess: (message: string) => void;
  handleAuthError: (error: any, operation?: string) => void;
  clearRegistrationPassword: () => void;
}

// --- Module-level helpers (outside hook body for React Compiler) ---

function handleAuthErrorImpl(
  error: any,
  handleApolloError: ReturnType<typeof useErrorService>['handleApolloError'],
  toast: ReturnType<typeof useToast>,
  onClearAuth: () => void,
  setIsLoading: (v: boolean) => void,
  operation: string,
): void {
  // Fire and forget - error handling is fully contained in callbacks
  executeMutation(
    async () => {
      const { message, code, isAuthError } = handleApolloError(error, {
        operation,
        logError: true,
      });

      toast({ message, type: 'error' });

      if (
        isAuthError &&
        (code === 'AUTH_TOKEN_EXPIRED' || code === 'AUTH_REFRESH_TOKEN_INVALID')
      ) {
        onClearAuth();
      }

      setIsLoading(false);
    },
    () => {
      toast({
        message: 'Something went wrong. Please try again.',
        type: 'error',
      });
      setIsLoading(false);
    },
  );
}

async function autoLoginImpl(
  credentialStorage: CredentialStorageEvents,
  loginMutation: (opts: any) => Promise<any>,
  handleLogin: (response: any, shouldRemember?: boolean) => Promise<boolean>,
  handleAuthError: (error: any, operation?: string) => void,
): Promise<boolean> {
  const result = await executeMutation(
    async () => {
      const hasStoredCreds = await credentialStorage.onCredentialCheck();

      if (!hasStoredCreds) {
        logger.info('No stored credentials found for auto-login');
        return false;
      }

      const credentials = await credentialStorage.onCredentialLoad();

      if (!credentials) {
        logger.info('Failed to load stored credentials');
        return false;
      }

      if (!credentials.email || !credentials.password) {
        logger.warn('Invalid credentials found, clearing them');
        await credentialStorage.onCredentialRemove();
        return false;
      }

      logger.info('Attempting auto-login with stored credentials');
      const loginResult = await loginMutation({
        variables: {
          input: {
            email: credentials.email,
            password: credentials.password,
          },
        },
      });

      if (loginResult.data?.login) {
        await handleLogin(loginResult.data.login, true);
        logger.info('Auto-login successful');
        return true;
      }

      if (loginResult.error) {
        logger.warn('Auto-login failed, clearing stored credentials');
        await credentialStorage.onCredentialRemove();
        handleAuthError(loginResult.error, 'Auto-login');
      }

      return false;
    },
    async error => {
      logger.error('Auto-login error:', error);
      await executeMutation(
        () => credentialStorage.onCredentialRemove(),
        'Failed to cleanup credentials after auto-login error',
      );
    },
  );

  return result || false;
}

async function loginImpl(
  input: LoginInput,
  showRememberPrompt: boolean,
  loginMutation: (opts: any) => Promise<any>,
  handleLogin: (
    response: any,
    shouldRemember?: boolean,
    credentials?: LoginCredentials,
  ) => Promise<boolean>,
  handleAuthError: (error: any, operation?: string) => void,
  credentialStorage: CredentialStorageEvents,
  rememberMe: RememberMeEvents,
  shouldShowCredentialPrompt: () => boolean,
  trackCredentialPromptShown: () => void,
  setIsLoading: (v: boolean) => void,
): Promise<boolean> {
  setIsLoading(true);

  const result = await executeMutation(
    async () => {
      const mutationResult = await loginMutation({ variables: { input } });

      if (mutationResult.data?.login) {
        const loginCredentials = {
          email: input.email,
          password: input.password,
        };

        const biometricTriggered = await handleLogin(
          mutationResult.data.login,
          true,
          loginCredentials,
        );

        if (showRememberPrompt && !biometricTriggered) {
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

      if (mutationResult.error) {
        handleAuthError(mutationResult.error);
        return false;
      }

      return false;
    },
    error => {
      handleAuthError(error);
    },
  );

  setIsLoading(false);
  return result || false;
}

async function registerImpl(
  input: RegisterInput,
  shouldRemember: boolean,
  registerMutation: (opts: any) => Promise<any>,
  handleRegistration: (
    response: any,
    shouldRemember?: boolean,
  ) => Promise<void>,
  handleAuthError: (error: any, operation?: string) => void,
  authState: AuthStateEvents,
  clearRegistrationPreferences: (userId: string) => void,
  setIsLoading: (v: boolean) => void,
  setIsInRegistrationFlow: (v: boolean) => void,
): Promise<boolean> {
  setIsLoading(true);
  setIsInRegistrationFlow(true);

  const result = await executeMutation(
    async () => {
      const mutationResult = await registerMutation({ variables: { input } });

      if (mutationResult.data?.register) {
        authState.onSetRegistrationPassword(input.password);

        // Persist to keychain — non-fatal if it fails
        await executeMutation(async () => {
          await clearTempRegistrationPassword();
          await saveTempRegistrationPassword(input.email, input.password);
        }, 'Non-fatal: failed to persist registration password to keychain');

        if (mutationResult.data.register.user?.id) {
          clearRegistrationPreferences(mutationResult.data.register.user.id);
        }

        await handleRegistration(mutationResult.data.register, shouldRemember);
        return true;
      }

      if (mutationResult.error) {
        handleAuthError(mutationResult.error, 'Register');
        return false;
      }

      return false;
    },
    error => {
      handleAuthError(error, 'Register');
    },
  );

  setIsLoading(false);
  setIsInRegistrationFlow(false);
  return result || false;
}

async function logoutImpl(
  user: any,
  clearAllCredentials: boolean,
  authState: AuthStateEvents,
  navigation: NavigationEvents,
  credentialStorage: CredentialStorageEvents,
  trackLogout: (userId: string) => void,
): Promise<void> {
  await executeMutation(async () => {
    const currentUserEmail = user?.email;
    const currentUserId = user?.id;

    await LogoutCleanup.performLogoutCleanup();

    if (currentUserId) {
      queueManager.onLogout(currentUserId);
    }

    authState.onClearAuth();
    LogoutCleanup.completeLogout();
    navigation.onNavigate('auth');

    if (currentUserId) {
      trackLogout(currentUserId);
    }

    if (clearAllCredentials) {
      await credentialStorage.onCredentialRemove();
    } else if (currentUserEmail) {
      await credentialStorage.onCredentialRemove(currentUserEmail);
    }
  }, 'Logout error');
}

/**
 * Pre-populate Zustand store with bootstrap IDs from the auth response.
 * Eliminates the GetHomes → GetPantry waterfall by letting
 * pantry and shopping list queries fire immediately in parallel.
 */
const bootstrapUserStore = (user: any): void => {
  const storeState = useStore.getState();
  if (user.defaultHomeId) {
    const pantries = user.defaultHome?.pantriesConnection?.edges;
    const defaultPantry =
      pantries?.find((e: any) => e.node.isDefault)?.node ?? pantries?.[0]?.node;
    const pantryId = defaultPantry?.id ?? null;

    storeState.setHomeAndPantry(user.defaultHomeId, pantryId);
    if (pantryId) {
      storeState.setIsHomeSelectionReady(true);
    }
  }
  if (user.defaultShoppingListId) {
    storeState.setSelectedShoppingListId(user.defaultShoppingListId);
  }
};

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
}: AuthOperationsProps): AuthOperationsReturn => {
  // Local state for auth operations
  const [isLoading, setIsLoading] = useState(false);
  const [isInRegistrationFlow, setIsInRegistrationFlow] = useState(false);

  // Dependencies
  const toast = useToast();
  const { handleApolloError } = useErrorService();
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
  const handleAuthSuccess = (message: string) => {
    logger.info('Auth success:', message);
  };

  const handleAuthError = (
    error: any,
    operation: string = 'Authentication',
  ) => {
    handleAuthErrorImpl(
      error,
      handleApolloError,
      toast,
      authState.onClearAuth,
      setIsLoading,
      operation,
    );
  };

  const handleLogin = async (
    loginResponse: any,
    shouldRemember?: boolean,
    loginCredentials?: LoginCredentials,
  ): Promise<boolean> => {
    if (!loginResponse?.user) {
      return false;
    }

    const { user, accessToken, refreshToken } = loginResponse;

    // Get previous user ID from queue store to detect user changes
    const previousUserId = queueStore.getCurrentUserId();

    // Set auth state first
    authState.onSetAuth(user, accessToken, refreshToken);

    // Notify queue manager about user change
    // This will clear the previous user's queue if it's a different user
    queueManager.onUserChange(user.id, previousUserId);

    bootstrapUserStore(user);

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
    incrementLoginCount(user.id);

    // **EXPLICIT NAVIGATION FLOW CONTROL**
    if (!user.emailVerified) {
      navigation.onNavigate('verification');
      return false;
    }

    if (!user.onBoarded) {
      navigation.onNavigate('onboarding');
      return false;
    }

    // User is fully authenticated - check biometric setup eligibility
    // BUT skip during registration flow, email verification, or onboarding to prevent unwanted biometric prompts
    if (
      loginCredentials &&
      !isInRegistrationFlow &&
      user.emailVerified &&
      user.onBoarded
    ) {
      const biometricResult = await executeQuery(
        () =>
          shouldShowPostLoginBiometricPrompt({
            id: user.id,
            email: loginCredentials.email,
          }),
        'Error checking biometric eligibility',
      );

      if (biometricResult?.shouldShow) {
        biometricSetup.onShowBiometricSetup(loginCredentials);
        return true;
      }
    }

    // Default: navigate to main app
    navigation.onNavigate('main_app');
    return false;
  };

  const handleRegistration = async (
    registerResponse: any,
    shouldRemember?: boolean,
  ) => {
    if (!registerResponse?.user) return;

    const { user, accessToken, refreshToken } = registerResponse;

    // Set auth state first
    authState.onSetAuth(user, accessToken, refreshToken);

    bootstrapUserStore(user);

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
  };

  // Auto-login functionality
  const autoLogin = async (): Promise<boolean> => {
    return autoLoginImpl(
      credentialStorage,
      loginMutation,
      handleLogin,
      handleAuthError,
    );
  };

  // Auth mutations
  const login = async (
    input: LoginInput,
    showRememberPrompt = true,
  ): Promise<boolean> => {
    return loginImpl(
      input,
      showRememberPrompt,
      loginMutation,
      handleLogin,
      handleAuthError,
      credentialStorage,
      rememberMe,
      shouldShowCredentialPrompt,
      trackCredentialPromptShown,
      setIsLoading,
    );
  };

  const register = async (
    input: RegisterInput,
    shouldRemember = true,
  ): Promise<boolean> => {
    return registerImpl(
      input,
      shouldRemember,
      registerMutation,
      handleRegistration,
      handleAuthError,
      authState,
      clearRegistrationPreferences,
      setIsLoading,
      setIsInRegistrationFlow,
    );
  };

  const logout = async (user: any, clearAllCredentials = false) => {
    await logoutImpl(
      user,
      clearAllCredentials,
      authState,
      navigation,
      credentialStorage,
      trackLogout,
    );
  };

  const clearRegistrationPassword = () => {
    authState.onClearRegistrationPassword();
  };

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
