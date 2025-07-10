import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {User} from '../../graphql/generated';

// the shape of your auth state
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  /** Call this once you have a fresh (user, accessToken, refreshToken) */
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;

  /** Flip this flag on the user if you verify their email later */
  setEmailVerified: (emailVerified: boolean) => void;

  /** Clears everything */
  logout: () => void;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
};

export const createAuthSlice: StateCreator<
  RootState,
  [['zustand/immer', never]], // ← so your set(state => { … }) is typed as Immer
  [],
  AuthState
> = (set, _get) => ({
  ...initialAuthState,

  setAuth: (user, accessToken, refreshToken) =>
    set(state => {
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
    }),

  setEmailVerified: emailVerified =>
    set(state => {
      if (state.user) state.user.emailVerified = emailVerified;
    }),

  logout: () =>
    set(state => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
    }),
});
