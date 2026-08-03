import { RootState } from './index';
import { zustandStorage, STORAGE_KEY } from '#/storage/mmkv';
import { storage } from '#/storage/mmkv';
import {
  clearTempRegistrationPassword,
  clearSessionTokens,
} from '#/storage/keychain';
import { cancelTokenRefresh } from '#/apollo/links/tokenScheduler';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { logger } from '#/utils/environment';

/**
 * Which server verdict ended the session. Used for the log line only — see
 * `endSession`, where the cleanup is deliberately identical for every value.
 *
 *  - `refresh_rejected`   — the refresh mutation's own response was an auth refusal
 *  - `refresh_token_dead` — an ordinary operation reported the refresh token gone or rejected
 *  - `account_inactive`   — the account is suspended, banned, or deleted
 *  - `session_revoked`    — the subscription socket closed on session auth again after a refresh
 */
export type SessionEndReason =
  | 'refresh_rejected'
  | 'refresh_token_dead'
  | 'account_inactive'
  | 'session_revoked';

// Simplified reset options
export interface ResetOptions {
  auth?: boolean;
  ui?: boolean;
  preferences?: boolean;
  clearApolloCache?: boolean;
}

// Simple reset scenarios
export const RESET_SCENARIOS = {
  LOGOUT: {
    auth: true,
    ui: true,
    preferences: false,
    clearApolloCache: true,
  },
  SESSION_EXPIRED: {
    auth: true,
    ui: false,
    preferences: false,
    clearApolloCache: false, // Preserve cache by default to support offline usage
  },
  FULL_RESET: {
    auth: true,
    ui: true,
    preferences: true,
    clearApolloCache: true,
  },
  ONBOARDING_RESET: {
    auth: false,
    ui: true,
    preferences: true,
    clearApolloCache: false,
  },
};

// Simplified reset manager
export const createResetManager = (
  set: (state: Partial<RootState>) => void,
  get: () => RootState,
) => ({
  resetStore: async (options: ResetOptions | keyof typeof RESET_SCENARIOS) => {
    const resetOptions =
      typeof options === 'string' ? RESET_SCENARIOS[options] : options;

    const newState: Partial<RootState> = {};

    // Reset auth state
    if (resetOptions.auth) {
      // The proactive refresh timer outlives the tokens it was scheduled for
      // unless it is cancelled here, and would fire against a cleared session.
      // `clearAuth` has always done this; an auth reset has to as well, or
      // which of the two a caller picked decides whether a timer survives.
      cancelTokenRefresh();

      Object.assign(newState, {
        user: null,
        accessToken: null,
        refreshToken: null,
        pendingEmail: undefined,
        pendingPassword: undefined,
        // In-flight auth progress. Left set, `isAutoLoggingIn` strands the
        // splash gate and `sessionTokensInKeychain` claims a keychain pair
        // that clearAuthFromStorage below has just removed.
        isAutoLoggingIn: false,
        sessionTokensInKeychain: false,
        // Clear navigation selections when auth is reset
        selectedHomeId: null,
        selectedPantryId: null,
        selectedShoppingListId: null,
        selectedMealPlanId: null,
        // Reset home data initialization flag to allow re-fetch on next login
        hasInitializedHomeData: false,
        // Reset home selection ready flag to prevent stale pantry queries on next login
        isHomeSelectionReady: false,
      });
    }

    // Reset UI state
    if (resetOptions.ui) {
      Object.assign(newState, {
        isLoading: false,
        isError: false,
        isFetching: false,
        bottomSheetVisible: false,
        bottomSheetIndex: 0,
        activeFormId: null,
        formData: {},
        globalSearchQuery: '',
        activeFilters: {},
        toastMessage: null,
        toastType: null,
      });
    }

    // Reset preferences (keep theme and language unless full reset)
    if (resetOptions.preferences) {
      Object.assign(newState, {
        // Reset onboarding state
        onBoardingStep: null,
        // Reset notifications
        notifications: [],
        unreadCount: 0,
        urgentCount: 0,
        // Reset scanner state
        scannedBarcode: null,
        isScanning: false,
        searchResults: [],
        searchError: null,
        recentlyScanned: [],
        scannerSheetVisible: false,
        scannerSheetIndex: 0,
      });
    }

    // Clear Apollo cache if requested
    if (resetOptions.clearApolloCache) {
      // The persisted blob goes first, in its own try, because it is the copy
      // that survives a restart: it holds the signed-out account's normalized
      // entities and a cold start restores from it. Sharing a try with the
      // in-memory clear below meant a failure there — including the client
      // module simply failing to load — skipped this entirely and left the
      // blob on disk, which is the exact leak the session-end path exists to
      // prevent. This removes the real MMKV keys (apollo-cache-v1 / -critical
      // / -deferred / -version) rather than relying on the onClearStore
      // handler or targeting a stale key name.
      try {
        apolloCachePersistence.clear();
      } catch (error) {
        logger.error('Error clearing persisted Apollo cache:', error);
      }

      // `client` is imported dynamically to break the require cycle
      // (store → resetManager → apollo/client → links → store). It stays
      // dynamic for that reason; ApolloCachePersistence is not in the cycle,
      // so it is imported normally above.
      try {
        const { client } = await import('#/apollo/client');
        await client.clearStore();
      } catch (error) {
        logger.error('Error clearing Apollo cache:', error);
      }
    }

    // Clear auth storage
    if (resetOptions.auth) {
      await clearAuthFromStorage();
    }

    // Apply the reset
    set(newState);

    // Ensure hydration flag remains true
    set({ isHydrated: true });
  },

  // Convenience methods
  logout: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('LOGOUT');

    // Reset navigation state to auth after logout
    set({ navigationState: 'auth' });
  },

  sessionExpired: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('SESSION_EXPIRED');
  },

  fullReset: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('FULL_RESET');
  },

  resetOnboarding: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('ONBOARDING_RESET');
  },

  endSession: async (reason: SessionEndReason) => {
    logger.info(`Session ended by the server (${reason}) — clearing session`);

    // Every reason performs the identical cleanup, deliberately: they are all
    // the same server verdict — this session is unrecoverable — and differ
    // only in which operation or transport carried it. `reason` exists for the
    // log line above, not to branch on. Any future reason that needs LESS
    // cleanup is not a session end and does not belong here.
    //
    // Clearing the Apollo cache is the part that must not vary. The persisted
    // MMKV blob holds the signed-out account's normalized entities, and
    // `cache-and-network` restores them on the next sign-in — so a path that
    // skips it shows the previous user's pantry and lists to the next one
    // until each query's network response lands.
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore({
      auth: true,
      ui: false,
      preferences: false,
      clearApolloCache: true,
    });
  },

  tokenRefreshFailed: async (
    reason: 'auth_rejected' | 'network' | 'unknown',
  ) => {
    if (reason === 'auth_rejected') {
      // Server confirmed invalid refresh token — genuine logout
      const resetManager = createResetManager(set, get);
      await resetManager.endSession('refresh_rejected');
    } else {
      // Network or unknown error — preserve auth state, defer refresh
      set({ needsTokenRefresh: true } as Partial<RootState>);
    }
  },
});

// Simplified auth storage cleanup
const clearAuthFromStorage = async () => {
  try {
    // Note: We intentionally do NOT clear keychain credentials during logout
    // This allows users to use biometric login after logging out
    // Keychain credentials are only cleared during full reset or explicit user action

    // Clear temp registration password from keychain (if any)
    await clearTempRegistrationPassword();

    // Clear the session tokens from their keychain tier
    await clearSessionTokens();

    // Clear individual auth-related keys
    storage.remove('accessToken');
    storage.remove('refreshToken');

    // Update persisted zustand data
    const currentData = await zustandStorage.getItem(STORAGE_KEY);
    if (currentData) {
      const parsedData = JSON.parse(currentData);
      if (parsedData.state) {
        // Clear auth-related fields only
        delete parsedData.state.user;
        delete parsedData.state.accessToken;
        delete parsedData.state.refreshToken;
        delete parsedData.state.pendingEmail;
        delete parsedData.state.pendingPassword;

        // Clear selected IDs
        delete parsedData.state.selectedHomeId;
        delete parsedData.state.selectedPantryId;
        delete parsedData.state.selectedShoppingListId;
        delete parsedData.state.selectedMealPlanId;
        // Reset home data initialization flag
        delete parsedData.state.hasInitializedHomeData;
        // Reset home selection ready flag
        delete parsedData.state.isHomeSelectionReady;

        zustandStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
      }
    }
  } catch (error) {
    logger.error('Error clearing auth from storage:', error);
  }
};
