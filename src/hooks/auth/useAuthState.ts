import { useAppStore, selectAuthTokens, selectAuthActions, selectPostLoginState } from '#store/useAppStore';
import { shallow } from 'zustand/shallow';

/**
 * Hook for managing core authentication state from Zustand store.
 * This hook handles all auth-related state selectors and computed properties.
 *
 * PERFORMANCE: Uses grouped selectors to reduce subscriptions from 16+ to 3
 */
export const useAuthState = () => {
  // PERFORMANCE: Group auth tokens into single subscription (5 fields)
  const { user, accessToken, refreshToken, isLoggingOut, isAutoLoggingIn } =
    useAppStore(selectAuthTokens, shallow);

  // PERFORMANCE: Group auth actions into single subscription (9 fields)
  const {
    setAuth,
    clearAuth,
    setTokens,
    updateUser,
    setEmailVerified,
    setOnboarded,
    setRememberMe,
    setIsAutoLoggingIn,
    setUserNavigationState,
  } = useAppStore(selectAuthActions, shallow);

  // PERFORMANCE: Group post-login state into single subscription (6 fields)
  const {
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
    setShowBiometricSetup,
    setPostLoginCredentials,
  } = useAppStore(selectPostLoginState, shallow);

  // Computed properties
  const isAuthenticated = !!(user && accessToken);
  const hasAnyToken = !!(accessToken || refreshToken);
  const isLoggedOut = !user && !accessToken && !refreshToken;
  const isTokenRefreshing = !accessToken && !!refreshToken;
  const canAttemptQueries = hasAnyToken && !isLoggingOut;

  return {
    // Core auth state
    user,
    accessToken,
    refreshToken,
    isLoggingOut,
    isAutoLoggingIn,

    // Computed properties
    isAuthenticated,
    hasAnyToken,
    isLoggedOut,
    isTokenRefreshing,
    canAttemptQueries,

    // Auth state actions
    setAuth,
    clearAuth,
    setTokens,
    updateUser,
    setEmailVerified,
    setOnboarded,
    setRememberMe,
    setIsAutoLoggingIn,
    setUserNavigationState,

    // Navigation state machine
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
    setShowBiometricSetup,
    setPostLoginCredentials,
  };
};