import type { RootState } from './index';
import { initialAppState } from './slices/appSlice';
import { TRANSIENT_UI_STATE } from './slices/uiSlice';
import { storage, zustandStorage } from '#/store/deviceStorage';
import { STORAGE_KEY } from '#/store/persistedKeys';
import { requirePlatform } from '#platform/install';
import { runSessionTeardown } from './sessionTeardown';
import { whileSessionEnds } from './sessionEnding';
import { resetSessionScopedStores } from './sessionScopedStores';
import { logger } from '#/utils/environment';
import { getApolloResetBridge } from './apolloResetBridge';
import { DEFAULT_CURRENCY } from '#/utils/formatters/number';
import { isRecord } from '#/utils/isRecord';

const secureStore = () => requirePlatform('secureStore');

/**
 * What ended the session — log line only; `endSession` performs identical
 * cleanup for every value. `signed_out` is the person's own sign-out;
 * `session_revoked` is the subscription socket refused as unrecoverable
 * (close 4412).
 */
export type SessionEndReason =
  | 'signed_out'
  | 'refresh_rejected'
  | 'refresh_token_dead'
  | 'account_inactive'
  | 'session_revoked';

/**
 * A sign-out the person chose. It also hands the offline queue off — only a
 * deliberate sign-out may discard unsynced work — and routes to sign-in. The
 * hand-off is a callback because the queue cannot be imported here: it reads
 * the store this module builds.
 */
export interface SessionEndOptions {
  deliberate?: { handOffQueue?: () => void };
}

export interface ResetOptions {
  auth?: boolean;
  ui?: boolean;
  preferences?: boolean;
  clearApolloCache?: boolean;
}

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
  // Left set, it claims a pair `clearAuthFromStorage` just removed.
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
  // The PREVIOUS account's setting. Login seeds it again from the server, so
  // the next person on a shared device starts from the default rather than
  // inheriting someone else's answer.
  showTutorials: true,
  // Likewise the previous account's: it denominates what the server records
  // next, so inheriting it would price one person's pantry in another's money.
  preferredCurrency: DEFAULT_CURRENCY,
} satisfies Partial<RootState>;

type SetState = (state: Partial<RootState>) => void;
type GetState = () => RootState;

let sessionEndInFlight: Promise<void> | null = null;

const runSessionEnd = async (
  set: SetState,
  get: GetState,
  reason: SessionEndReason,
  options: SessionEndOptions | undefined,
): Promise<void> => {
  logger.info(`Session ended (${reason}) — clearing session`);

  // Every end gets identical cleanup — `reason` is for the log line, not to
  // branch on. The cache is cleared here as well as by the teardown's `apollo`
  // step, which swallows its own failures: the persisted blob holds the
  // signed-out account's entities and `cache-and-network` restores them on the
  // next sign-in.

  // Transports stop FIRST, so in-flight work is cancelled rather than re-fired
  // against cleared tokens (the endless-loading symptom). One scope over the
  // whole descent: a latched gate refuses the next sign-in until a restart.
  await whileSessionEnds(async () => {
    await runSessionTeardown();
    options?.deliberate?.handOffQueue?.();

    await createResetManager(set, get).resetStore({
      auth: true,
      ui: true,
      preferences: false,
      clearApolloCache: true,
    });
    if (options?.deliberate) get().setNavigationState('auth');
  });
};

export const createResetManager = (set: SetState, get: GetState) => ({
  resetStore: async (resetOptions: ResetOptions) => {
    const newState: Partial<RootState> = {};

    if (resetOptions.auth) {
      // The proactive refresh timer outlives the tokens it was scheduled for
      // and would fire against a cleared session.
      getApolloResetBridge()?.cancelTokenRefresh();

      // Under `auth`, not `preferences`: a sign-out resets with
      // `preferences: false`, so anything filed there survives it on a shared
      // device.
      Object.assign(newState, SESSION_SCOPED_STATE);

      // SESSION_SCOPED_STATE only reaches the ROOT store; feature-owned stores
      // register their own reset.
      resetSessionScopedStores();
    }

    if (resetOptions.ui) {
      Object.assign(newState, TRANSIENT_UI_STATE);
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
      const apollo = getApolloResetBridge();
      try {
        apollo?.clearPersistedCache();
      } catch (error) {
        logger.error('Error clearing persisted Apollo cache:', error);
      }

      try {
        await apollo?.clearStore();
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

  endSession: async (reason: SessionEndReason, options?: SessionEndOptions) => {
    // Every transport reporting a dead session fires this unawaited; a second
    // pass would re-run the teardown under the gate the first one holds. A
    // sign-out joining a server end finds the session already gone.
    if (sessionEndInFlight) return sessionEndInFlight;

    sessionEndInFlight = runSessionEnd(set, get, reason, options);
    return sessionEndInFlight.finally(() => {
      sessionEndInFlight = null;
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
      set({ needsTokenRefresh: true });
    }
  },
});

const clearAuthFromStorage = async () => {
  try {
    // Stored logins (biometrics) deliberately survive a logout; only a full
    // reset or an explicit user action clears them.
    await secureStore().clearSessionTokens();

    storage.remove('accessToken');
    storage.remove('refreshToken');

    const currentData = await zustandStorage.getItem(STORAGE_KEY);
    if (currentData) {
      const parsedData: unknown = JSON.parse(currentData);
      if (isRecord(parsedData) && isRecord(parsedData.state)) {
        const persistedState = parsedData.state;
        // The same keys `resetStore` clears in memory. Persist rewrites the
        // whole blob after `set(newState)`; this covers the window in between,
        // where a kill leaves this copy for the next person's session.
        for (const key of Object.keys(SESSION_SCOPED_STATE)) {
          delete persistedState[key];
        }

        zustandStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));
      }
    }
  } catch (error) {
    logger.error('Error clearing auth from storage:', error);
  }
};
