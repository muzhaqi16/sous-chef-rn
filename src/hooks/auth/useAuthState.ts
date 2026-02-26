;
import { useAppStore, selectAuthTokens, selectAuthActions, selectPostLoginState } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

/**
 * Hook for managing core authentication state from Zustand store.
 * This hook handles all auth-related state selectors and computed properties.
 *
 * PERFORMANCE: Uses grouped selectors to reduce subscriptions from 16+ to 3
 */
export const useAuthState = () => {
  // PERFORMANCE: Group auth tokens into single subscription with useShallow (Zustand v5 API)
  const { user, accessToken, refreshToken, isLoggingOut, isAutoLoggingIn } =
    useAppStore(useShallow(selectAuthTokens));

  // PERFORMANCE: Group auth actions into single subscription with useShallow (Zustand v5 API)
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
  } = useAppStore(useShallow(selectAuthActions));

  // PERFORMANCE: Group post-login state into single subscription with useShallow (Zustand v5 API)
  const {
    navigationState,
    showBiometricSetup,
    postLoginCredentials,
    setNavigationState,
    setShowBiometricSetup,
    setPostLoginCredentials,
  } = useAppStore(useShallow(selectPostLoginState));

  // Computed properties
  const isAuthenticated = !!(user && accessToken);
  const hasAnyToken = !!(accessToken || refreshToken);
  const isLoggedOut = !user && !accessToken && !refreshToken;
  const isTokenRefreshing = !accessToken && !!refreshToken;
  const canAttemptQueries = hasAnyToken && !isLoggingOut;

  // PERFORMANCE: Memoize return object to prevent infinite re-renders
  // Without memoization, every render creates a new object reference causing cascade re-renders
  return ({
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
    });
};