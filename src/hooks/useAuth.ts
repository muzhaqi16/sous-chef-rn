import {useStore} from '../store';

export const useAuth = () =>
  useStore(state => ({
    user: state.user,
    accessToken: state.accessToken,
    refreshToken: state.refreshToken,
    setAuth: state.setAuth,
    logout: state.logout,
  }));
