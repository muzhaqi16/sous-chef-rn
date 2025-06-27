import {StateCreator} from 'zustand';
import {loginApi, signupApi} from '../api/services/authService';
import {RootState} from './useStore';
import {User} from '../api/graphql/generated';
import {storage} from '../storage/mmkv';

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
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

  login: async (email, password) => {
    try {
      // Reset any previous errors or state
      get().reset();
      const {accessToken, refreshToken, user} = await loginApi(email, password);
      set({user, accessToken, refreshToken});
      // Store tokens in MMKV storage
      storage.set('accessToken', accessToken);
      storage.set('refreshToken', refreshToken);
      // Optionally, you can also store user data
      storage.set('user', JSON.stringify(user));
      // Return null to indicate success
      return null;
    } catch (err) {
      console.error(err);
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
      set({user, accessToken, refreshToken});
      return null;
    } catch (err) {
      console.error(err);
      return err instanceof Error ? err.message : 'Unknown error';
    }
  },

  logout: () => {
    get().reset();
  },
});
