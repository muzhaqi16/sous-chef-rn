import { useStore } from '#store';

/**
 * Hook for managing core authentication state from Zustand store.
 * This hook handles all auth-related state selectors and computed properties.
 */
export const useAuthState = () => {
  // Auth state from store
  const user = useStore(state => state.user);
  const accessToken = useStore(state => state.accessToken);
  const refreshToken = useStore(state => state.refreshToken);
  const isLoggingOut = useStore(state => state.isLoggingOut);
  const isAutoLoggingIn = useStore(state => state.isAutoLoggingIn);
  const setAuth = useStore(state => state.setAuth);
  const clearAuth = useStore(state => state.clearAuth);
  const setTokens = useStore(state => state.setTokens);
  const updateUser = useStore(state => state.updateUser);
  const setEmailVerified = useStore(state => state.setEmailVerified);
  const setOnboarded = useStore(state => state.setOnboarded);
  const setRememberMe = useStore(state => state.setRememberMe);
  const setIsAutoLoggingIn = useStore(state => state.setIsAutoLoggingIn);
  const setUserNavigationState = useStore(state => state.setUserNavigationState);

  // Navigation state machine actions
  const navigationState = useStore(state => state.navigationState);
  const showBiometricSetup = useStore(state => state.showBiometricSetup);
  const postLoginCredentials = useStore(state => state.postLoginCredentials);
  const setNavigationState = useStore(state => state.setNavigationState);
  const setShowBiometricSetup = useStore(state => state.setShowBiometricSetup);
  const setPostLoginCredentials = useStore(state => state.setPostLoginCredentials);

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