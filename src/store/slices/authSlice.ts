// ============================================
// store/slices/authSlice.ts
// Updated to work with your existing store structure
// Implements proactive token refresh (best practice)
// ============================================

import { StateCreator } from 'zustand';
import { jwtDecode } from 'jwt-decode';
import { RootState } from '../index';
import {
  scheduleTokenRefresh,
  cancelTokenRefresh,
} from '../../apollo/links/tokenScheduler';
import { proactiveTokenRefresh } from '../../apollo/links/refreshToken';
import { saveSessionTokens, clearSessionTokens } from '#storage/keychain';
import { logger } from '#/utils/environment';

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

/**
 * Refresh the access token if it's expired or expiring. Call this on
 * background → active transitions from the single AppState listener
 * owned by useAppStateLifecycle. Module-scope so the try-catch is safe
 * — React Compiler doesn't apply outside hook bodies.
 */
export const handleTokenRefreshOnResume = async (
  getAccessToken: () => string | null,
): Promise<void> => {
  const accessToken = getAccessToken();
  if (!accessToken || !isTokenExpiredOrExpiring(accessToken)) return;

  logger.debug(
    '[AuthSlice] Token expired/expiring on app resume, refreshing...',
  );
  try {
    await proactiveTokenRefresh();
  } catch {
    logger.warn(
      '[AuthSlice] Token refresh on resume failed, reactive refresh will handle',
    );
  }
};

/**
 * The signed-in user as persisted. `email` / `emailVerified` / `role` are
 * API-gated (null unless the caller is that user or an admin), so they stay
 * nullable — read defensively (`user?.email || fallback`), never assert.
 */
export interface User {
  id: string;
  email: string | null;
  emailVerified: boolean | null;
  onBoarded: boolean;
  role?: string | null;
  canAccessDevTools?: boolean;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  name?: string;
}

/**
 * Shape accepted by `setAuth`. The `LoginUser` fragment carries a nested
 * `profile` the persisted `User` does not model; flattening it here is what
 * feeds the greeting (`user.firstName` / `user.name`) without a cast.
 */
export type AuthUserInput = User & {
  profile?: {
    displayName?: string | null;
    avatar?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

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

  // Transient loading state for authService (not persisted)
  authIsLoading: boolean;
  authIsLoadingCredentials: boolean;

  // True once the keychain is confirmed to hold the current token pair.
  // While false, partialize (store/index.ts) keeps the pair in the MMKV blob
  // as a fallback so a failed keychain write/read can't lose the session.
  sessionTokensInKeychain: boolean;

  // Computed property
  getIsAuthenticated: () => boolean;

  // Actions
  setAuth: (
    user: AuthUserInput,
    accessToken: string,
    refreshToken: string,
  ) => void;
  updateUser: (updates: Partial<User>) => void;
  setTokens: (tokens: { accessToken?: string; refreshToken?: string }) => void;
  setEmailVerified: (verified: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  clearAuth: () => void;
  setHasStoredCredentials: (has: boolean | null) => void;
  setIsAutoLoggingIn: (loading: boolean) => void;
  setAuthIsLoading: (v: boolean) => void;
  setAuthIsLoadingCredentials: (v: boolean) => void;
  setSessionTokensInKeychain: (inKeychain: boolean) => void;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  hasStoredCredentials: null,
  isAutoLoggingIn: false,
  authIsLoading: false,
  authIsLoadingCredentials: false,
  sessionTokensInKeychain: false,
};

export const createAuthSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AuthState
> = (set, get) => {
  /**
   * Write-through token persistence: session tokens live in the keychain
   * (saveSessionTokens skips identical pairs). The result drives
   * `sessionTokensInKeychain` — while false, partialize keeps the pair in
   * the MMKV blob as a fallback so a failed write can't lose the session.
   */
  const persistSessionTokens = (
    accessToken: string | null,
    refreshToken: string | null,
  ): void => {
    if (!(accessToken && refreshToken)) return;
    void saveSessionTokens({ accessToken, refreshToken }).then(saved => {
      set(state => {
        state.sessionTokensInKeychain = saved;
      });
    });
  };

  return {
    ...initialAuthState,

    getIsAuthenticated: () => {
      const state = get();
      return !!(state.user && state.accessToken);
    },

    setAuth: (user, accessToken, refreshToken) => {
      set(state => {
        // Clear stale navigation state if the user changed (or no previous user).
        // This prevents a new user from inheriting another user's selectedHomeId,
        // which would cause "Not authorized to access pantries in this home" errors.
        const previousUserId = state.user?.id;
        if (!previousUserId || previousUserId !== user.id) {
          state.selectedHomeId = null;
          state.selectedPantryId = null;
          state.selectedShoppingListId = null;
          state.hasInitializedHomeData = false;
          state.isHomeSelectionReady = false;
        }

        // Flatten profile fields from the login/register GraphQL response so the
        // greeting can render the user's name immediately without a separate query.
        const profile = user.profile;

        // Normalize email to prevent validation issues (trim whitespace, lowercase)
        state.user = {
          ...user,
          email: user.email?.trim().toLowerCase() ?? user.email,
          firstName: profile?.firstName ?? user.firstName,
          lastName: profile?.lastName ?? user.lastName,
          name: profile?.displayName ?? user.name,
          profilePicture: profile?.avatar ?? user.profilePicture,
        };
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        state.isAutoLoggingIn = false; // Clear auto-login state on success
      });

      persistSessionTokens(accessToken, refreshToken);

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

      // Read back from the store so partial updates persist the full pair
      const updated = get();
      persistSessionTokens(updated.accessToken, updated.refreshToken);

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
        state.sessionTokensInKeychain = false;
        // Keep rememberMe preference
      });

      // clearSessionTokens reports failure via its own logging; a false result
      // means the pair may still be readable on the next launch.
      void clearSessionTokens();
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

    setAuthIsLoading: v => {
      set(state => {
        state.authIsLoading = v;
      });
    },

    setAuthIsLoadingCredentials: v => {
      set(state => {
        state.authIsLoadingCredentials = v;
      });
    },

    setSessionTokensInKeychain: inKeychain => {
      set(state => {
        state.sessionTokensInKeychain = inKeychain;
      });
    },
  };
};
