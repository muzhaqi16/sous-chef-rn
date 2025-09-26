import { useCallback } from 'react';
import { useAuthState } from './useAuthState';
import { useCredentialStorage } from './useCredentialStorage';
import { useRememberMe, type RememberMeCredentials } from './useRememberMe';
import { useBiometricPrompting } from './useBiometricPrompting';
import { useAuthOperations, type LoginCredentials } from './useAuthOperations';
import { useUserPreferences } from '#/hooks/navigation/useUserPreferences';
import { useStore } from '#store';

/**
 * Main authentication hook that composes all auth-related functionality.
 * This hook maintains backward compatibility while providing a clean,
 * modular internal architecture based on event-driven communication.
 */
export const useAuth = () => {
  // Core auth state management
  const authState = useAuthState();

  // Store for registration password
  const { registrationPassword, setRegistrationPassword, clearRegistrationPassword } = useStore();

  // Credential storage operations
  const credentialStorage = useCredentialStorage();

  // Biometric prompting logic
  const { shouldShowPostLoginBiometricPrompt, recordBiometricPromptResponse } = useBiometricPrompting();

  // User preferences for biometric tracking
  const { markBiometricDeclined, markBiometricEnabled } = useUserPreferences();

  // Event handlers for RememberMe flow
  const handleRememberMeAccept = useCallback(async (credentials: RememberMeCredentials) => {
    await credentialStorage.storeCredentials(credentials.email, credentials.password);
  }, [credentialStorage]);

  const handleRememberMeDecline = useCallback(() => {
    // Just tracking - handled internally by useRememberMe
  }, []);

  // RememberMe modal logic with event handlers
  const rememberMe = useRememberMe({
    onAccept: handleRememberMeAccept,
    onDecline: handleRememberMeDecline,
  });

  // Event handlers for biometric setup completion
  const handlePostLoginBiometricComplete = useCallback((enabled: boolean, declined?: boolean) => {
    // Close biometric setup modal
    authState.setShowBiometricSetup(false);

    // Record user's response
    recordBiometricPromptResponse(enabled, declined);

    if (enabled) {
      markBiometricEnabled();
    } else if (declined) {
      markBiometricDeclined();
    }

    // Navigate to main app after biometric setup
    authState.setNavigationState('main_app');

    // Clean up credentials
    authState.setPostLoginCredentials(null);
  }, [
    authState,
    recordBiometricPromptResponse,
    markBiometricEnabled,
    markBiometricDeclined,
  ]);

  // Event handlers for auth operations
  const handleShowRememberMe = useCallback((credentials: LoginCredentials) => {
    rememberMe.showRememberMePrompt(credentials);
  }, [rememberMe]);

  const handleShowBiometricSetup = useCallback((credentials: LoginCredentials) => {
    authState.setPostLoginCredentials(credentials);
    authState.setShowBiometricSetup(true);
    authState.setNavigationState('biometric_setup');
  }, [authState]);

  // Convert credential storage functions to event interface
  const credentialStorageEvents = {
    onCredentialCheck: credentialStorage.checkStoredCredentials,
    onCredentialLoad: async (email?: string): Promise<LoginCredentials | null> => {
      const result = await credentialStorage.loadStoredCredentials(email);
      return result ? { email: result.email, password: result.password } : null;
    },
    onCredentialStore: credentialStorage.storeCredentials,
    onCredentialRemove: credentialStorage.removeCredentials,
  };

  // Auth operations with all event handlers
  const authOperations = useAuthOperations({
    credentialStorage: credentialStorageEvents,
    rememberMe: {
      onShowRememberMe: handleShowRememberMe,
    },
    biometricSetup: {
      onShowBiometricSetup: handleShowBiometricSetup,
    },
    navigation: {
      onNavigate: authState.setNavigationState,
    },
    authState: {
      onSetAuth: authState.setAuth,
      onClearAuth: authState.clearAuth,
      onSetRememberMe: authState.setRememberMe,
      onSetUserNavigationState: authState.setUserNavigationState,
      onSetRegistrationPassword: setRegistrationPassword,
      onClearRegistrationPassword: clearRegistrationPassword,
    },
    // Pass biometric prompting logic directly
    shouldShowPostLoginBiometricPrompt,
  });

  // Logout wrapper that passes user info
  const logout = (clearAllCredentials = false) => {
    return authOperations.logout(authState.user, clearAllCredentials);
  };

  // Return the same interface as the original useAuth hook for backward compatibility
  return {
    // State from useAuthState
    user: authState.user,
    accessToken: authState.accessToken,
    refreshToken: authState.refreshToken,
    isAuthenticated: authState.isAuthenticated,
    isLoggingOut: authState.isLoggingOut,
    isAutoLoggingIn: authState.isAutoLoggingIn,
    hasAnyToken: authState.hasAnyToken,
    isLoggedOut: authState.isLoggedOut,
    isTokenRefreshing: authState.isTokenRefreshing,
    canAttemptQueries: authState.canAttemptQueries,

    // Loading states
    isLoading: authOperations.isLoading,
    isLoadingCredentials: credentialStorage.isLoadingCredentials,

    // Actions from useAuthOperations
    login: authOperations.login,
    register: authOperations.register,
    logout,
    autoLogin: authOperations.autoLogin,

    // Auth state actions
    setAuth: authState.setAuth,
    clearAuth: authState.clearAuth,
    setTokens: authState.setTokens,
    updateUser: authState.updateUser,
    setEmailVerified: authState.setEmailVerified,
    setOnboarded: authState.setOnboarded,
    setIsAutoLoggingIn: authState.setIsAutoLoggingIn,

    // Credential management from useCredentialStorage
    checkStoredCredentials: credentialStorage.checkStoredCredentials,
    loadStoredCredentials: credentialStorage.loadStoredCredentials,
    storeCredentials: credentialStorage.storeCredentials,
    removeCredentials: credentialStorage.removeCredentials,
    getAvailableAccounts: credentialStorage.getAvailableAccounts,
    getBiometricInfo: credentialStorage.getBiometricInfo,

    // RememberMe modal from useRememberMe
    showRememberMeModal: rememberMe.showRememberMeModal,
    pendingCredentials: rememberMe.pendingCredentials,
    handleRememberMeAccept: rememberMe.handleRememberMeAccept,
    handleRememberMeDecline: rememberMe.handleRememberMeDecline,

    // Navigation state machine (from useAuthState)
    navigationState: authState.navigationState,
    showBiometricSetup: authState.showBiometricSetup,
    setNavigationState: authState.setNavigationState,
    setShowBiometricSetup: authState.setShowBiometricSetup,

    // Post-login biometric prompt (direct from useBiometricPrompting)
    postLoginCredentials: authState.postLoginCredentials,
    handlePostLoginBiometricComplete,

    // Registration password for onboarding (from store)
    registrationPassword,
    setRegistrationPassword,
    clearRegistrationPassword,

    // Handlers from useAuthOperations
    handleLogin: authOperations.handleLogin,
    handleRegistration: authOperations.handleRegistration,
    handleAuthSuccess: authOperations.handleAuthSuccess,
    handleAuthError: authOperations.handleAuthError,
  };
};