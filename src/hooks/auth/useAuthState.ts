import {
  useAuthTokens,
  useAuthActions,
  usePostLoginState,
} from '#store/useAppStore';

/**
 * Hook for managing core authentication state from Zustand store.
 * Composes 3 grouped selectors (useAuthTokens, useAuthActions, usePostLoginState),
 * each returning shallow-equal references via Zustand's equalityFn integration.
 *
 * The returned object's identity is stable across renders because:
 *   1. Each sub-hook uses useShallow → same reference when values unchanged
 *   2. The React Compiler auto-memoizes the returned object literal based on
 *      its destructured deps (no useMemo needed; CLAUDE.md forbids it)
 *
 * Net subscriptions: 3 (one per sub-hook), regardless of consumer count.
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
