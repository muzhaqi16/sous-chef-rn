// ============================================
// store/slices/authSlice.ts
// Updated to work with your existing store structure
// Implements proactive token refresh (best practice)
// ============================================

import { StateCreator } from 'zustand';
import { AppState, AppStateStatus } from 'react-native';
import { jwtDecode } from 'jwt-decode';
import { RootState } from '../index';
import {
  scheduleTokenRefresh,
  cancelTokenRefresh,
} from '../../apollo/links/tokenScheduler';
import { proactiveTokenRefresh } from '../../apollo/links/refreshToken';

// ============================================
// AppState Token Refresh
// Handles token refresh when app resumes from background
// (setTimeout doesn't fire reliably when backgrounded)
// ============================================

/**
 * Check if token is expired or about to expire
 */
const isTokenExpiredOrExpiring = (accessToken: string | null): boolean => {
  if (!accessToken) return true;
  try {
    const decoded = jwtDecode<{ exp: number }>(accessToken);
    const expiresAt = decoded.exp * 1000;
    const now = Date.now();
    // Consider expired if less than 1 minute remaining
    return expiresAt - now < 60 * 1000;
  } catch {
    return true;
  }
};

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null =
  null;
let lastAppState: AppStateStatus = AppState.currentState;

/**
 * Initialize AppState listener for token refresh on app resume
 * Call this once at app startup (e.g., in App.tsx)
 */
export const initAppStateTokenRefresh = (
  getAccessToken: () => string | null,
) => {
  if (appStateSubscription) return; // Already initialized

  appStateSubscription = AppState.addEventListener(
    'change',
    async (nextAppState: AppStateStatus) => {
      // App coming to foreground from background
      if (
        lastAppState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        const accessToken = getAccessToken();
        if (accessToken && isTokenExpiredOrExpiring(accessToken)) {
          console.log(
            '[AuthSlice] Token expired/expiring on app resume, refreshing...',
          );
          try {
            await proactiveTokenRefresh();
          } catch {
            console.warn(
              '[AuthSlice] Token refresh on resume failed, reactive refresh will handle',
            );
          }
        }
      }
      lastAppState = nextAppState;
    },
  );
};

/**
 * Cleanup AppState listener (call on app unmount)
 */
export const cleanupAppStateTokenRefresh = () => {
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
};

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
  // NOTE: rememberMe is owned by preferencesSlice — do NOT duplicate here
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
  setHasStoredCredentials: (has: boolean | null) => void;
  setIsAutoLoggingIn: (loading: boolean) => void;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
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
      // Normalize email to prevent validation issues (trim whitespace, lowercase)
      state.user = {
        ...user,
        email: user.email?.trim().toLowerCase() ?? user.email,
      };
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
        // Normalize email if present in updates
        const normalizedUpdates = updates.email
          ? { ...updates, email: updates.email.trim().toLowerCase() }
          : updates;
        Object.assign(state.user, normalizedUpdates);
      }
    });
  },

  setTokens: ({ accessToken, refreshToken }) => {
    set(state => {
      if (accessToken !== undefined) state.accessToken = accessToken;
      if (refreshToken !== undefined) state.refreshToken = refreshToken;
    });

    // Schedule proactive token refresh whenever tokens are updated
    // The tokenScheduler has built-in offline protection, so we always schedule
    // This ensures refresh is scheduled even after offline->online transitions
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
