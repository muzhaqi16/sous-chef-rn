import {
  useAuthTokens,
  useAuthActions,
  usePostLoginState,
} from '#store/useAppStore';

/**
 * Hook for managing core authentication state from Zustand store.
 * This hook handles all auth-related state selectors and computed properties.
 *
 * PERFORMANCE: Uses grouped selectors to reduce subscriptions from 16+ to 3
 */
export const useAuthState = () => {
  const { user, accessToken, refreshToken, isLoggingOut, isAutoLoggingIn } =
    useAuthTokens();

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
  } = useAuthActions();

  const {
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
    setShowBiometricSetup,
    setPostLoginCredentials,
  } = usePostLoginState();

  // Computed properties
  const isAuthenticated = !!(user && accessToken);
  const hasAnyToken = !!(accessToken || refreshToken);
  const isLoggedOut = !user && !accessToken && !refreshToken;
  const isTokenRefreshing = !accessToken && !!refreshToken;
  const canAttemptQueries = hasAnyToken && !isLoggingOut;

  // PERFORMANCE: Memoize return object to prevent infinite re-renders
  // Without memoization, every render creates a new object reference causing cascade re-renders
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
