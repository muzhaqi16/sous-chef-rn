import type { StateCreator } from 'zustand';
import type { RootState } from '../index';
import { mirroredFrom, type MirroredSettings } from '#/domain/serverSettings';
import {
  cancelProactiveRefresh,
  refreshTokenNow,
  scheduleProactiveRefresh,
} from '../tokenRefreshBridge';
import { isSessionEnding } from '../sessionEnding';
import { isTokenExpiringSoon } from '#/utils/tokenExpiry';
import { retryCooldownMs } from '#/utils/backoff';
import { requirePlatform } from '#platform/install';
import { logger } from '#/utils/environment';
import type { UserRole } from '#/graphql/generated/schemaTypes';

const secureStore = () => requirePlatform('secureStore');

// A resume is worth a refresh only when the token is about to stop working.
const RESUME_REFRESH_BUFFER_MS = 60 * 1000;

/**
 * Called on background → active by useAppStateLifecycle's one AppState
 * listener, as a backgrounded setTimeout does not fire reliably. Module-scope,
 * so the React Compiler never sees its try-catch.
 */
export const handleTokenRefreshOnResume = async (
  getAccessToken: () => string | null,
): Promise<void> => {
  const accessToken = getAccessToken();
  if (
    !accessToken ||
    !isTokenExpiringSoon(accessToken, RESUME_REFRESH_BUFFER_MS)
  )
    return;

  logger.debug(
    '[AuthSlice] Token expired/expiring on app resume, refreshing...',
  );
  try {
    await refreshTokenNow();
  } catch {
    logger.warn(
      '[AuthSlice] Token refresh on resume failed, reactive refresh will handle',
    );
  }
};

/**
 * The signed-in user as persisted. `email` / `emailVerified` / `role` are
 * API-gated, null unless the caller is that user or an admin: read them with a
 * fallback, never assert (`firstNonBlank` where a blank must fall through).
 */
export interface User {
  id: string;
  email: string | null;
  emailVerified: boolean | null;
  onBoarded: boolean;
  role?: UserRole | null;
  canAccessDevTools?: boolean;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  name?: string;
  /**
   * The name a HOUSEMATE or collaborator reads this account by — gated by the
   * sharing relationship, unlike `profile.displayName` which profile visibility
   * can withhold. `name` above is the profile one, flattened for the greeting.
   */
  displayName?: string | null;
  /** ISO code; null until the person states one. See `src/domain/money.ts`. */
  preferredCurrency?: string | null;
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
  settings?:
    | (Partial<MirroredSettings> & {
        /** The account's currency lives on its settings; absent until a first write. */
        preferredCurrency?: string | null;
      })
    | null;
};

/**
 * What became of a token pair. `outlived`: the refresh token it renews is no
 * longer the stored one, so the pair belongs to a session that is gone.
 */
export type TokenPairWrite = 'stored' | 'session_ending' | 'outlived';

export interface AuthState {
  // Core auth state
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Auth preferences
  hasStoredCredentials: boolean | null;

  // Wall-clock deadline before another device-credential exchange may be sent,
  // and the count behind it. A DEADLINE, not a countdown, so a backgrounded JS
  // thread cannot stretch it, and persisted so a relaunch cannot skip it.
  biometricRetryAt: number;
  biometricAttempts: number;

  // Transient loading state for authService (not persisted)
  authIsLoading: boolean;

  // True once the keychain is confirmed to hold the current token pair.
  // While false, partialize (store/index.ts) keeps the pair in the MMKV blob
  // as a fallback so a failed keychain write/read can't lose the session.
  sessionTokensInKeychain: boolean;

  // Actions
  /** False when a session end is in progress: the sign-in is discarded. */
  setAuth: (
    user: AuthUserInput,
    accessToken: string,
    refreshToken: string,
  ) => boolean;
  updateUser: (updates: Partial<User>) => void;
  /** `replaces`: the refresh token the pair renews, when it renews one. */
  setTokens: (tokens: {
    accessToken?: string;
    refreshToken?: string;
    replaces?: string;
  }) => TokenPairWrite;
  setEmailVerified: (verified: boolean) => void;
  setOnboarded: (onboarded: boolean) => void;
  clearAuth: () => void;
  setHasStoredCredentials: (has: boolean | null) => void;
  registerBiometricRefusal: (retryAfterMs?: number) => void;
  clearBiometricBackoff: () => void;
  setAuthIsLoading: (v: boolean) => void;
  setSessionTokensInKeychain: (inKeychain: boolean) => void;
}

/** A session's tokens are held: signed in, or signing back in from either one. */
export const holdsSessionTokens = (
  state: Pick<AuthState, 'accessToken' | 'refreshToken'>,
): boolean => !!state.accessToken || !!state.refreshToken;

/** Signed in with a token requests can carry now. */
export const isSignedIn = <S extends Pick<AuthState, 'user' | 'accessToken'>>(
  state: S,
): state is S & { user: User; accessToken: string } =>
  !!state.user && !!state.accessToken;

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  hasStoredCredentials: null,
  biometricRetryAt: 0,
  biometricAttempts: 0,
  authIsLoading: false,
  sessionTokensInKeychain: false,
};

export const createAuthSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AuthState
> = (set, get) => {
  /**
   * Session tokens live in the keychain; while `sessionTokensInKeychain` is
   * false, partialize keeps the pair in the MMKV blob so a failed write can't
   * lose the session.
   */
  const persistSessionTokens = (
    accessToken: string | null,
    refreshToken: string | null,
  ): void => {
    if (!(accessToken && refreshToken)) return;
    void secureStore()
      .saveSessionTokens({ accessToken, refreshToken })
      .then(saved => {
        set(state => {
          state.sessionTokensInKeychain = saved;
        });
      });
  };

  return {
    ...initialAuthState,

    setAuth: (user, accessToken, refreshToken) => {
      if (isSessionEnding()) {
        logger.warn('Discarded a sign-in that arrived while the session ended');
        return false;
      }
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
        const currency =
          user.settings?.preferredCurrency ?? user.preferredCurrency;

        // Normalize email to prevent validation issues (trim whitespace, lowercase)
        state.user = {
          ...user,
          email: user.email?.trim().toLowerCase() ?? user.email,
          firstName: profile?.firstName ?? user.firstName,
          lastName: profile?.lastName ?? user.lastName,
          name: profile?.displayName ?? user.name,
          profilePicture: profile?.avatar ?? user.profilePicture,
          preferredCurrency: currency,
        };
        state.accessToken = accessToken;
        state.refreshToken = refreshToken;
        // Mirrored out of the auth payload so every money surface can read it
        // without a query of its own; the reset manager clears it on sign-out.
        if (currency) {
          state.preferredCurrency = currency;
        }
        // The account's mirrored settings, before any screen paints; a session
        // end puts back the signed-out values.
        Object.assign(state, mirroredFrom(user.settings));
      });

      persistSessionTokens(accessToken, refreshToken);

      // Schedule proactive token refresh (best practice)
      // This will automatically refresh the token 5 minutes before it expires
      // to prevent user-facing 401 errors and provide seamless UX
      scheduleProactiveRefresh(accessToken);
      return true;
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

    setTokens: ({ accessToken, refreshToken, replaces }) => {
      if (replaces !== undefined && get().refreshToken !== replaces) {
        logger.info('Discarded a token pair that outlived its session');
        return 'outlived';
      }
      // Landing mid sign-out, a credential outlives it and re-arms the refresh
      // the teardown cancelled.
      if (isSessionEnding()) {
        logger.warn(
          'Discarded a token pair that arrived while the session ended',
        );
        return 'session_ending';
      }
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
        scheduleProactiveRefresh(accessToken);
      }
      return 'stored';
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
      cancelProactiveRefresh();

      set(state => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.sessionTokensInKeychain = false;
      });

      // clearSessionTokens reports failure via its own logging; a false result
      // means the pair may still be readable on the next launch.
      void secureStore().clearSessionTokens();
    },

    setHasStoredCredentials: has => {
      set(state => {
        state.hasStoredCredentials = has;
      });
    },

    registerBiometricRefusal: retryAfterMs => {
      set(state => {
        state.biometricAttempts += 1;
        // The server's own deadline wins: it knows what budget is left.
        const wait = retryAfterMs ?? retryCooldownMs(state.biometricAttempts);
        state.biometricRetryAt = Date.now() + wait;
      });
    },

    clearBiometricBackoff: () => {
      set(state => {
        state.biometricAttempts = 0;
        state.biometricRetryAt = 0;
      });
    },

    setAuthIsLoading: v => {
      set(state => {
        state.authIsLoading = v;
      });
    },

    setSessionTokensInKeychain: inKeychain => {
      set(state => {
        state.sessionTokensInKeychain = inKeychain;
      });
    },
  };
};
