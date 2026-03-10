import { useAppStore } from '#store/useAppStore';

export const useIsLoggedOut = () => {
  const user = useAppStore(state => state.user);
  const accessToken = useAppStore(state => state.accessToken);
  const refreshToken = useAppStore(state => state.refreshToken);
  return !user && !accessToken && !refreshToken;
};
