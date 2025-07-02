import {StateCreator} from 'zustand';
import {loginApi, signupApi} from '../../api/services/authService';
import {RootState} from '../index';
import {User} from '../../api/graphql/generated';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  authenticate: (
    email: string,
    password: string,
  ) => Promise<
    {user: User; accessToken: string; refreshToken: string} | {error: string}
  >;

  setAuth: (user: User, accessToken: string, refreshToken: string) => void;

  login: (email: string, password: string) => Promise<string | null>;
  signup: (
    username: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
  logout: () => void;
}

export const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

export const createAuthSlice: StateCreator<RootState, [], [], AuthState> = (
  set,
  get,
) => ({
  ...initialAuthState,

  authenticate: async (email, password) => {
    try {
      const {accessToken, refreshToken, user} = await loginApi(email, password);
      return {user, accessToken, refreshToken};
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },

  setAuth: (user, accessToken, refreshToken) =>
    set(() => ({
      user,
      accessToken,
      refreshToken,
    })),

  login: async (email, password) => {
    get().reset();
    try {
      const {accessToken, refreshToken, user} = await loginApi(email, password);
      set(() => ({
        user,
        accessToken,
        refreshToken,
      }));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  },

  signup: async (username, email, password) => {
    try {
      const {accessToken, refreshToken, user} = await signupApi(
        username,
        email,
        password,
      );
      set(() => ({
        user,
        accessToken,
        refreshToken,
      }));
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Unknown error';
    }
  },

  logout: () => get().reset(),
});
