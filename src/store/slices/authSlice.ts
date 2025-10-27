// ============================================
// store/slices/authSlice.ts
// Updated to work with your existing store structure
// Implements proactive token refresh (best practice)
// ============================================

import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { scheduleTokenRefresh, cancelTokenRefresh } from '../../apollo/links/tokenScheduler';
import { proactiveTokenRefresh } from '../../apollo/links/refreshToken';

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

  // Auto-login state
  isAutoLoggingIn: boolean;

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
  setIsAutoLoggingIn: (loading: boolean) => void;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  rememberMe: true, // Default to true for simplified flow
  hasStoredCredentials: null,
  isAutoLoggingIn: false,
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
      state.isAutoLoggingIn = false; // Clear auto-login state on success
    });

    // Schedule proactive token refresh (best practice)
    // This will automatically refresh the token 5 minutes before it expires
    // to prevent user-facing 401 errors and provide seamless UX
    scheduleTokenRefresh(accessToken, async () => {
      await proactiveTokenRefresh();
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

    // Schedule proactive token refresh whenever tokens are updated
    // This handles both initial login and token refresh scenarios
    if (accessToken) {
      scheduleTokenRefresh(accessToken, async () => {
        await proactiveTokenRefresh();
      });
    }
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
    // Cancel any scheduled token refresh before clearing auth
    // This prevents refresh attempts with invalid/cleared tokens
    cancelTokenRefresh();

    set(state => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAutoLoggingIn = false;
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

  setIsAutoLoggingIn: loading => {
    set(state => {
      state.isAutoLoggingIn = loading;
    });
  },
});
