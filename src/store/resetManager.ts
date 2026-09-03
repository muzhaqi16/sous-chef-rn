import type { RootState } from './index';
import { initialAppState } from './slices/appSlice';
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
 * Which server verdict ended the session — log line only; `endSession` performs
 * identical cleanup for every value. `session_revoked` is the subscription
 * socket refused as unrecoverable (close 4412).
 */
export type SessionEndReason =
  | 'refresh_rejected'
  | 'refresh_token_dead'
  | 'account_inactive'
  | 'session_revoked';

export interface ResetOptions {
  auth?: boolean;
  ui?: boolean;
  preferences?: boolean;
  clearApolloCache?: boolean;
}

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
 * The signed-in person's store fields and their signed-out values. The ONE list:
 * `resetStore` applies it in memory and `clearAuthFromStorage` deletes the same
 * keys from the blob, so the two cannot disagree. The reference caches are
 * deliberately absent — account-independent, clearing costs offline autocomplete.
 */
const SESSION_SCOPED_STATE = {
  user: null,
  accessToken: null,
  refreshToken: null,
  // Left set, `isAutoLoggingIn` strands the splash gate and
  // `sessionTokensInKeychain` claims a pair `clearAuthFromStorage` just removed.
  isAutoLoggingIn: false,
  sessionTokensInKeychain: false,
  // Navigation selections — the previous account's home/pantry/list ids.
  selectedHomeId: null,
  selectedPantryId: null,
  selectedShoppingListId: null,
  selectedMealPlanId: null,
  // Allow a re-fetch on next login; stop stale pantry queries hitting it.
  hasInitializedHomeData: false,
  isHomeSelectionReady: false,
  // Persisted, and shown directly to whoever opens the app next. Feature-owned
  // persisted state clears through resetSessionScopedStores() instead.
  cachedItemSuggestions: initialAppState.cachedItemSuggestions,
} satisfies Partial<RootState>;

export const createResetManager = (
  set: (state: Partial<RootState>) => void,
  get: () => RootState,
) => ({
  resetStore: async (options: ResetOptions | keyof typeof RESET_SCENARIOS) => {
    const resetOptions =
      typeof options === 'string' ? RESET_SCENARIOS[options] : options;

    const newState: Partial<RootState> = {};

    if (resetOptions.auth) {
      // The proactive refresh timer outlives the tokens it was scheduled for
      // and would fire against a cleared session.
      cancelTokenRefresh();

      // Under `auth`, not `preferences`: `LOGOUT` sets `preferences: false`, so
      // anything filed there survives a sign-out on a shared device.
      Object.assign(newState, SESSION_SCOPED_STATE);

      // SESSION_SCOPED_STATE only reaches the ROOT store; feature-owned stores
      // register their own reset.
      resetSessionScopedStores();
    }

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

    // Keeps theme and language unless FULL_RESET.
    if (resetOptions.preferences) {
      Object.assign(newState, {
        onBoardingStep: null,
      });

      // Idempotent, and deliberately in both branches: ONBOARDING_RESET
      // (auth: false, preferences: true) must still empty feature stores.
      resetSessionScopedStores();
    }

    if (resetOptions.clearApolloCache) {
      // The persisted blob goes first, in its OWN try: it is the copy that
      // survives a restart, so sharing a try with the in-memory clear lets a
      // failure there leave the signed-out account's entities on disk.
      try {
        apolloCachePersistence.clear();
      } catch (error) {
        logger.error('Error clearing persisted Apollo cache:', error);
      }

      // Dynamic import breaks the require cycle
      // (store → resetManager → apollo/client → links → store).
      try {
        const { client } = await import('#/apollo/client');
        await client.clearStore();
      } catch (error) {
        logger.error('Error clearing Apollo cache:', error);
      }
    }

    if (resetOptions.auth) {
      await clearAuthFromStorage();
    }

    set(newState);
    set({ isHydrated: true });
  },

  logout: async () => {
    const resetManager = createResetManager(set, get);
    await resetManager.resetStore('LOGOUT');

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

    // Every reason gets identical cleanup deliberately — `reason` is for the
    // log line, not to branch on. Clearing the Apollo cache is the part that
    // must not vary: the persisted blob holds the signed-out account's
    // entities and `cache-and-network` restores them on the next sign-in.

    // Transports stop FIRST, so in-flight work is cancelled rather than
    // re-fired against cleared tokens (the endless-loading symptom).
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
      const resetManager = createResetManager(set, get);
      await resetManager.endSession('refresh_rejected');
    } else {
      // Network or unknown: keep auth state, defer the refresh.
      set({ needsTokenRefresh: true } as Partial<RootState>);
    }
  },
});

const clearAuthFromStorage = async () => {
  try {
    // Biometric keychain credentials deliberately survive a logout; only a full
    // reset or an explicit user action clears them.
    await clearTempRegistrationPassword();
    await clearSessionTokens();

    storage.remove('accessToken');
    storage.remove('refreshToken');

    const currentData = await zustandStorage.getItem(STORAGE_KEY);
    if (currentData) {
      const parsedData = JSON.parse(currentData);
      if (parsedData.state) {
        // The same keys `resetStore` clears in memory. Persist rewrites the
        // whole blob after `set(newState)`; this covers the window in between,
        // where a kill leaves this copy for the next person's session.
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
