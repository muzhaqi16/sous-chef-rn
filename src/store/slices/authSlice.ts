import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {User} from '../../graphql/generated';

// the shape of your auth state
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  pendingEmail?: string;
  pendingPassword?: string;

  /** Call this once you have a fresh (user, accessToken, refreshToken) */
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;

  /** Flip this flag on the user if you verify their email later */
  setEmailVerified: (emailVerified: boolean) => void;

  setPendingCredentials: (email: string, password: string) => void;
  clearPendingCredentials: () => void;

  /** Clears everything */
  logout: () => void;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  pendingEmail: undefined,
  pendingPassword: undefined,
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
  setPendingCredentials: (email, password) =>
    set(state => {
      state.pendingEmail = email;
      state.pendingPassword = password;
    }),

  clearPendingCredentials: () =>
    set(state => {
      state.pendingEmail = undefined;
      state.pendingPassword = undefined;
    }),
  logout: () =>
    set(state => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.pendingEmail = undefined;
      state.pendingPassword = undefined;
      state.resetPreferences(); // Clear preferences on logout
      // Optionally clear any other state related to the user session
      // e.g., shopping lists, items, etc.
    }),
});
