import {useStore} from '#store';

export const useAuth = () => {
  const user = useStore(state => state.user);
  const accessToken = useStore(state => state.accessToken);
  const refreshToken = useStore(state => state.refreshToken);
  const setAuth = useStore(state => state.setAuth);
  const clearAuth = useStore(state => state.clearAuth);
  const setTokens = useStore(state => state.setTokens);
  const updateUser = useStore(state => state.updateUser);
  const setEmailVerified = useStore(state => state.setEmailVerified);
  const setOnboarded = useStore(state => state.setOnboarded);

  // Computed property
  const isAuthenticated = !!(user && accessToken);

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated,
    setAuth,
    clearAuth,
    setTokens,
    updateUser,
    setEmailVerified,
    setOnboarded,
  };
};
