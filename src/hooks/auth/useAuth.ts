import { useStore } from '../../store';

export const useAuth = () => {
  const user = useStore(state => state.user);
  const accessToken = useStore(state => state.accessToken);
  const refreshToken = useStore(state => state.refreshToken);
  const setAuth = useStore(state => state.setAuth);
  const logout = useStore(state => state.logout);

  return {
    user,
    accessToken,
    refreshToken,
    setAuth,
    logout,
  };
};