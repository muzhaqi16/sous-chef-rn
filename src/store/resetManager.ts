import { RootState } from './index';
import { initialAppState } from './slices/appSlice';
import { initialBarcodeScannerState } from './slices/barcodeScannerSlice';
import { zustandStorage, STORAGE_KEY } from '#/storage/mmkv';
import { storage } from '#/storage/mmkv';
import {
  clearTempRegistrationPassword,
  clearSessionTokens,
} from '#/storage/keychain';
import { cancelTokenRefresh } from '#/apollo/links/tokenScheduler';
import { apolloCachePersistence } from '#/apollo/offline/ApolloCachePersistence';
import { runSessionTeardown } from './sessionTeardown';
import { resetSessionScopedStores } from './sessionScopedStores';
import { logger } from '#/utils/environment';

/**
 * Which server verdict ended the session. Used for the log line only — see
 * `endSession`, where the cleanup is deliberately identical for every value.
 *
 *  - `refresh_rejected`   — the refresh mutation's own response was an auth refusal
 *  - `refresh_token_dead` — an ordinary operation reported the refresh token gone or rejected
 *  - `account_inactive`   — the account is suspended, banned, or deleted
 *  - `session_revoked`    — the subscription socket was refused as unrecoverable (close 4412)
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

/**
 * Everything in the store that belongs to the signed-in person, and the value
 * each field takes when nobody is signed in.
 *
 * This is the one list. `resetStore` applies it in memory and
 * `clearAuthFromStorage` deletes the same keys from the persisted blob, so the
 * two cannot disagree about what a session end removes — which is how the
 * notification inbox, the scanner's recent list and the item-suggestion LRU
 * came to survive a sign-out on a shared device.
 *
 * The reference caches (`cachedUnits` / `cachedCategories` / `cachedBrands` /
 * `cachedStores`) are deliberately absent: catalog data warmed for offline
 * autocomplete, identical for every account, revealing nothing about who was
 * signed in. Clearing them would cost offline autocomplete for no privacy gain.
 */
const SESSION_SCOPED_STATE = {
  // `pendingEmail` / `pendingPassword` are deliberately absent: they are not
  // fields of `RootState`, and the persist migration sweeps every
  // non-allowlisted key, so they cannot be in a blob to clear.
  user: null,
  accessToken: null,
  refreshToken: null,
  // In-flight auth progress. Left set, `isAutoLoggingIn` strands the splash
  // gate and `sessionTokensInKeychain` claims a keychain pair that
  // `clearAuthFromStorage` has just removed.
  isAutoLoggingIn: false,
  sessionTokensInKeychain: false,
  // Navigation selections — the previous account's home/pantry/list ids.
  selectedHomeId: null,
  selectedPantryId: null,
  selectedShoppingListId: null,
  selectedMealPlanId: null,
  // Allow a re-fetch on the next login, and stop stale pantry queries firing
  // against the new session.
  hasInitializedHomeData: false,
  isHomeSelectionReady: false,
  // Persisted and rendered directly to whoever opens the app next: the
  // notification inbox, the barcode scanner's recent list, and the catalog
  // items the item autocomplete offers as suggestions. The two slices are
  // spread whole from their own initial state, so a field added to either is
  // cleared here without anyone remembering to come back.
  ...initialBarcodeScannerState,
  cachedItemSuggestions: initialAppState.cachedItemSuggestions,
} satisfies Partial<RootState>;

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

      // Applied under `auth` rather than `preferences` because this data ends
      // with the session: `LOGOUT` sets `preferences: false`, so anything
      // filed there survives a sign-out on a shared device.
      Object.assign(newState, SESSION_SCOPED_STATE);

      // `SESSION_SCOPED_STATE` only reaches the ROOT store. A feature that owns
      // its own store registers its reset separately — without this, feature
      // state would survive a sign-out exactly as the two recipe caches do.
      resetSessionScopedStores();
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
        // The same slice the auth branch clears — spread rather than re-listed,
        // so the two branches cannot describe "empty" differently.
        ...initialBarcodeScannerState,
      });

      // Idempotent, and deliberately in both branches: this is where the
      // notification buffer used to be cleared by spreading its initial state,
      // so ONBOARDING_RESET (auth: false, preferences: true) still empties it.
      resetSessionScopedStores();
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

    // Stop the transports FIRST, so in-flight work is cancelled rather than
    // re-fired against cleared tokens. Without this the socket keeps dialling,
    // in-flight queries keep landing and the queue keeps waking, all against
    // credentials the server has already refused — a dead session that goes on
    // asking, which is what the user sees as an endless loading state.
    await runSessionTeardown();

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
        // The same keys `resetStore` clears in memory. Zustand's persist
        // middleware rewrites the whole blob after `set(newState)`, so this is
        // about the window in between: killed there, the in-memory reset is
        // lost and this copy is what the next person's session restores from.
        // Keys that aren't persisted simply aren't in the blob — deleting them
        // is a no-op, and driving both from one list is what keeps the on-disk
        // cleanup from falling behind the in-memory one.
        for (const key of Object.keys(SESSION_SCOPED_STATE)) {
          delete parsedData.state[key];
        }

        zustandStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
      }
    }
  } catch (error) {
    logger.error('Error clearing auth from storage:', error);
  }
};
