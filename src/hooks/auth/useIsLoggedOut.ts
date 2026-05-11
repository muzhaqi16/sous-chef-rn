import { useAppStore, useUser } from '#store/useAppStore';

export const useIsLoggedOut = () => {
  const user = useUser();
  const accessToken = useAppStore(state => state.accessToken);
  const refreshToken = useAppStore(state => state.refreshToken);
  return !user && !accessToken && !refreshToken;
};
