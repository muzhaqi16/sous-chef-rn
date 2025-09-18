// ============================================
// store/slices/authSlice.ts
// Updated to work with your existing store structure
// ============================================

import { StateCreator } from 'zustand';
import { RootState } from '../index';

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  onBoarded: boolean;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  name?: string;
}

export interface AuthState {
  // Core auth state
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Auth preferences
  rememberMe: boolean | undefined;
  hasStoredCredentials: boolean | null;

  // Pending credentials for verification flow
  pendingEmail?: string;
  pendingPassword?: string;

  // Computed property
  getIsAuthenticated: () => boolean;

  // Actions
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (updates: Partial<User>) => void;
  setTokens: (tokens: { accessToken?: string; refreshToken?: string }) => void;
  setEmailVerified: (verified: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  clearAuth: () => void;
  setRememberMe: (remember: boolean) => void;
  setHasStoredCredentials: (has: boolean | null) => void;
  setPendingCredentials: (email: string, password: string) => void;
  clearPendingCredentials: () => void;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  rememberMe: undefined,
  hasStoredCredentials: null,
  pendingEmail: undefined,
  pendingPassword: undefined,
};

export const createAuthSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AuthState
> = (set, get) => ({
  ...initialAuthState,

  getIsAuthenticated: () => {
    const state = get();
    return !!(state.user && state.accessToken);
  },

  setAuth: (user, accessToken, refreshToken) => {
    set(state => {
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;

      // Clear pending credentials when auth succeeds
      state.pendingEmail = undefined;
      state.pendingPassword = undefined;
    });
  },

  updateUser: updates => {
    set(state => {
      if (state.user) {
        Object.assign(state.user, updates);
      }
    });
  },

  setTokens: ({ accessToken, refreshToken }) => {
    set(state => {
      if (accessToken !== undefined) state.accessToken = accessToken;
      if (refreshToken !== undefined) state.refreshToken = refreshToken;
    });
  },

  setEmailVerified: verified => {
    set(state => {
      if (state.user) {
        state.user.emailVerified = verified;
      }
    });
  },

  setOnboarded: onboarded => {
    set(state => {
      if (state.user) {
        state.user.onBoarded = onboarded;
      }
    });
  },

  clearAuth: () => {
    set(state => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.pendingEmail = undefined;
      state.pendingPassword = undefined;
      // Keep rememberMe preference
    });
  },

  setRememberMe: remember => {
    set(state => {
      state.rememberMe = remember;
    });
  },

  setHasStoredCredentials: has => {
    set(state => {
      state.hasStoredCredentials = has;
    });
  },

  setPendingCredentials: (email, password) => {
    set(state => {
      state.pendingEmail = email;
      state.pendingPassword = password;
    });
  },

  clearPendingCredentials: () => {
    set(state => {
      state.pendingEmail = undefined;
      state.pendingPassword = undefined;
    });
  },
});
