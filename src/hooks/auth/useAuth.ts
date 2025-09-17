import {useStore} from '#store';

export const useAuth = () => {
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

  // Computed properties
  const isAuthenticated = !!(user && accessToken);
  const hasAnyToken = !!(accessToken || refreshToken);
  const isLoggedOut = !user && !accessToken && !refreshToken;

  // Helper for token refresh scenarios
  const isTokenRefreshing = !accessToken && !!refreshToken;
  const canAttemptQueries = hasAnyToken && !isLoggingOut;

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    isLoggingOut,
    hasAnyToken,
    isLoggedOut,
    isTokenRefreshing,
    canAttemptQueries,
    setAuth,
    clearAuth,
    setTokens,
    updateUser,
    setEmailVerified,
    setOnboarded,
  };
};
