/**
 * Persistence is an explicit allowlist (`PERSISTED_KEYS`): a field is transient
 * until named there. Default-transient fails safe — a missed setting doesn't
 * survive restart, rather than a stale value overriding a code default forever.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware';

enableMapSet();
import { createAuthSlice, AuthState } from './slices/authSlice';
import {
  applyThemePreferenceToRuntime,
  createPreferencesSlice,
  PreferencesState,
} from './slices/preferencesSlice';
import { FontScalePreference } from './slices/preferenceTypes';
import { createAppSlice, AppState } from './slices/appSlice';
import { createUISlice, UIState } from './slices/uiSlice';
import { createTutorialSlice, TutorialState } from './slices/tutorialSlice';
import {
  createResetManager,
  ResetOptions,
  RESET_SCENARIOS,
  SessionEndReason,
} from './resetManager';

import {
  createNavigationSlice,
  NavigationState,
} from './slices/navigationSlice';
import { createTelemetrySlice, TelemetryState } from './slices/telemetrySlice';
import {
  createNetworkSlice,
  hydrateOfflineModeFromStorage,
  NetworkState,
} from './slices/networkSlice';
import {
  zustandStorage,
  STORAGE_KEY,
  isRecoveryStorage,
  openedWithEmptyStore,
} from '#/storage/mmkv';
import {
  loadSessionTokens,
  pickFresherSessionTokens,
  clearSessionTokens,
  type SessionTokenLoadResult,
} from '#/storage/keychain';
import { logger } from '#/utils/environment';
// Type-only: a value import would close the telemetry→useStore cycle.
import type { ErrorService } from '#/services/errorService';

/**
 * Loads session tokens from the keychain (their persistence tier) before
 * flipping `isHydrated`, so the first authenticated paint sees the session.
 * The MMKV blob keeps a fallback pair until the keychain copy confirms.
 */
const hydrateSessionTokensThenFinish = async (
  state: RootState | undefined,
): Promise<void> => {
  // A keychain item outlives the app on iOS. With the encrypted store empty
  // there is no local state behind those tokens — a reinstall, or cleared app
  // data — so the session is not resumed and the credentials are dropped.
  if (openedWithEmptyStore()) {
    await clearSessionTokens();
    state?.setHydrated(true);
    return;
  }

  // `?? { status: 'absent' }` tolerates legacy test mocks resolving null.
  const result: SessionTokenLoadResult = (await loadSessionTokens()) ?? {
    status: 'absent',
  };
  if (result.status === 'ok') {
    const fallback =
      state?.accessToken && state?.refreshToken
        ? { accessToken: state.accessToken, refreshToken: state.refreshToken }
        : null;
    const tokens = pickFresherSessionTokens(result.tokens, fallback);
    // setTokens schedules the proactive refresh and the keychain write-through.
    state?.setTokens(tokens);
    if (tokens === result.tokens) {
      state?.setSessionTokensInKeychain(true);
    }
  } else if (state?.accessToken && state?.refreshToken) {
    // MMKV fallback: the write-through self-heals the keychain, and partialize
    // keeps this copy until `sessionTokensInKeychain` confirms.
    if (result.status === 'error') {
      logger.warn('Session token load failed; using the MMKV fallback session');
    }
    state.setTokens({
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    });
  }
  state?.setHydrated(true);
};

/**
 * Persist rehydration listener, extracted so it can be unit-tested directly.
 * On error it still flips `isHydrated`, or RootNavigator hangs on the loading
 * screen forever.
 */
export const handleStoreRehydration = (
  state: RootState | undefined,
  error: unknown,
): void => {
  if (error) {
    // Recover first, so a throw in reporting cannot block the boot.
    useStore.getState().setHydrated(true);
    // Deferred require: telemetry imports `useStore`, so a static import would
    // close the module-load cycle.
    const { errorService } = require('#/services/errorService') as {
      errorService: ErrorService;
    };
    errorService.reportError(error, { operation: 'storeHydration' });
    return;
  }

  // Before `isHydrated`, so no hook needs a side-effect to catch up.
  if (state?.theme) {
    applyThemePreferenceToRuntime(state.theme);
  }

  // Before `isHydrated`, so the first paint is in the user's language. Lazy —
  // `#/i18n` pulls in `i18n/config`, which has load-time side effects.
  const language = state?.language;
  if (language && language !== 'en') {
    import('#/i18n').then(({ changeLanguage }) => {
      void changeLanguage(language);
    });
  }

  void hydrateSessionTokensThenFinish(state);

  // Spans JS-bundle entry to this callback, so it is dominated by module
  // evaluation, not by store hydration (~5 ms of it). The name has to say so.
  const startTs = (globalThis as { __APP_START_TIMESTAMP?: number })
    .__APP_START_TIMESTAMP;
  if (startTs) {
    import('#services/telemetry').then(({ Telemetry }) => {
      Telemetry.histogram(
        'app_js_entry_to_store_ready_ms',
        Date.now() - startTs,
      );
    });
  }

  // Outside persist (see partialize) so the last setting is readable before
  // GetUserSettings resolves.
  if (state?.setOfflineModeEnabled) {
    hydrateOfflineModeFromStorage(state.setOfflineModeEnabled);
  }
};

interface ResetManagerState {
  resetStore: (
    options: ResetOptions | keyof typeof RESET_SCENARIOS,
  ) => Promise<void>;
  logout: () => Promise<void>;
  fullReset: () => Promise<void>;
  sessionExpired: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  endSession: (reason: SessionEndReason) => Promise<void>;
  tokenRefreshFailed: (
    reason: 'auth_rejected' | 'network' | 'unknown',
  ) => Promise<void>;
}

interface NavigationStateManagerState {
  initiateLogout: () => boolean;
  completeLogout: () => boolean;
}

// Minimal shape of the persisted user touched by the v8 → v9 migration.
interface MigratableUser {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  profilePicture?: string | null;
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    displayName?: string | null;
    avatar?: string | null;
  } | null;
}

export type RootState = AuthState &
  PreferencesState &
  AppState &
  NavigationState &
  UIState &
  TutorialState &
  TelemetryState &
  NetworkState &
  ResetManagerState &
  NavigationStateManagerState;

/** Non-function fields of the store — the keys persistence has to classify. */
type StateDataKey = {
  [K in keyof RootState]-?: RootState[K] extends (...args: never[]) => unknown
    ? never
    : K;
}[keyof RootState];

/** Literal-preserving: infers argument literals and rejects non-data keys. */
const classifyKeys = <K extends StateDataKey>(
  ...keys: readonly K[]
): readonly K[] => keys;

/**
 * The only fields written to the MMKV blob. Genuine user data and user choices
 * only — never derived, session or lifecycle state. Shape locked by
 * `src/store/__tests__/persistOptions.test.ts`.
 */
const PERSISTED_KEYS = classifyKeys(
  // Auth. The token pair lives in the keychain; partialize re-adds it below
  // while that copy is unconfirmed.
  'user',
  'rememberMe',
  'hasStoredCredentials',
  'showBiometricSetup',

  // User preferences
  'theme',
  'language',
  'primaryColorOverride',
  'densityPreference',
  'fontScalePreference',
  'highContrast',
  'hapticFeedbackEnabled',
  'showNavigationLabels',
  'showTutorials',
  'pantrySortOption',
  'pantrySortDirection',
  'userPreferences',

  // Entity selections + navigation memory
  'selectedHomeId',
  'selectedPantryId',
  'selectedShoppingListId',
  'selectedMealPlanId',
  'navigationState',
  'userNavigationStates',

  // Offline reference caches + freshness stamps (autocomplete warmth)
  'cachedUnits',
  'cachedCategories',
  'cachedBrands',
  'cachedStores',
  // Usage LRU, not a fetched catalog slice — hence no freshness stamp.
  'cachedItemSuggestions',
  'lastUnitsFetchedAt',
  'lastCategoriesFetchedAt',
  'lastBrandsFetchedAt',
  'lastStoresFetchedAt',

  // Tutorials: which hints each account has seen, and its login count.
  'featureHintsShown',
  'loginCounts',

  // Telemetry: the one real user choice (the feature flags are env-derived)
  'userConsent',
);

type PersistedKey = (typeof PERSISTED_KEYS)[number];

/** Queryable form, for the v13 migration sweep. */
const PERSISTED_KEY_SET: ReadonlySet<string> = new Set(PERSISTED_KEYS);

/** Keys allowed in the blob beyond the allowlist: the keychain-fallback pair. */
const BLOB_ONLY_KEYS: ReadonlySet<string> = new Set([
  'accessToken',
  'refreshToken',
]);

export { PERSISTED_KEYS };

const pickPersisted = (state: RootState): Pick<RootState, PersistedKey> => {
  const persisted = {} as Pick<RootState, PersistedKey>;
  for (const key of PERSISTED_KEYS) {
    assignKey(persisted, state, key);
  }
  return persisted;
};

// Separate generic so each assignment is typed per-key instead of as the
// intersection of all persisted value types.
const assignKey = <K extends PersistedKey>(
  target: Pick<RootState, PersistedKey>,
  source: RootState,
  key: K,
): void => {
  target[key] = source[key];
};

export const useStore = create<RootState>()(
  subscribeWithSelector(
    persist(
      immer(
        // Wrap this in zustand's `logger(...)` to trace every state change.
        (set, get, store) => {
          const resetManager = createResetManager(set, get);

          const navigationStateManager: NavigationStateManagerState = {
            initiateLogout: () => {
              set(state => {
                state.isLoggingOut = true;
              });
              return true;
            },
            completeLogout: () => {
              set(state => {
                state.isLoggingOut = false;
              });
              return true;
            },
          };

          return {
            ...createAuthSlice(set, get, store),
            ...createPreferencesSlice(set, get, store),
            ...createAppSlice(set, get, store),
            ...createNavigationSlice(set, get, store),
            ...createUISlice(set, get, store),
            ...createTutorialSlice(set, get, store),
            ...createTelemetrySlice(set, get, store),
            ...createNetworkSlice(set, get, store),
            ...resetManager,
            ...navigationStateManager,
          };
        },
      ),
      {
        name: STORAGE_KEY,
        version: 15,
        storage: createJSONStorage(() => zustandStorage),
        migrate: (persistedState: unknown, version: number) => {
          // v8 → v9: lift nested profile fields to top level — the greeting
          // reads user.firstName / user.name directly.
          if (version < 9) {
            const state = persistedState as { user?: MigratableUser } | null;
            const user = state?.user;
            const profile = user?.profile;
            if (user && profile) {
              user.firstName = profile.firstName ?? user.firstName;
              user.lastName = profile.lastName ?? user.lastName;
              user.name = profile.displayName ?? user.name;
              user.profilePicture = profile.avatar ?? user.profilePicture;
            }
          }

          // v9 → v10: remap the dropped 'system' font scale to a valid
          // FontScalePreference member.
          if (version < 10) {
            const state = persistedState as {
              fontScalePreference?: string;
            } | null;
            if (state?.fontScalePreference === 'system') {
              state.fontScalePreference = FontScalePreference.MD;
            }
          }

          // Migration → v14: enforce the PERSISTED_KEYS allowlist over any
          // older blob. Re-run on every bump that changes the allowlist — a key
          // REMOVED from it otherwise sits in the blob unreachable and uncleared
          // until a root write happens to replace it. The keychain-fallback
          // token pair is the only sanctioned passenger outside the allowlist.
          if (version < 14) {
            const state = persistedState as Record<string, unknown> | null;
            if (state) {
              for (const key of Object.keys(state)) {
                if (!PERSISTED_KEY_SET.has(key) && !BLOB_ONLY_KEYS.has(key)) {
                  delete state[key];
                }
              }
            }
          }

          // v14 → v15: drop the warmed unit vocabulary — the API merged 46
          // alias `Unit` rows away, so a warmed row can name an id the server
          // cannot resolve. The STAMP goes with the list: unit autocomplete is
          // the only one running `localFirst`, and an empty list left with a
          // fresh stamp stays empty for the whole TTL instead of re-warming.
          if (version < 15) {
            const state = persistedState as Record<string, unknown> | null;
            if (state) {
              delete state.cachedUnits;
              delete state.lastUnitsFetchedAt;
            }
          }

          return persistedState;
        },
        onRehydrateStorage: () => handleStoreRehydration,
        skipHydration: false,
        partialize: state => {
          // Only PERSISTED_KEYS data fields enter the blob; actions and
          // unclassified keys cannot leak in.
          const persisted = pickPersisted(state);

          // Losing both token tiers logs the user out, so the pair stays in the
          // blob while the keychain copy is unconfirmed. Never on the recovery
          // instance — that file is unencrypted at rest, so persisting tokens
          // there would defeat the fail-closed contract.
          if (
            !state.sessionTokensInKeychain &&
            state.accessToken &&
            state.refreshToken &&
            !isRecoveryStorage()
          ) {
            return {
              ...persisted,
              accessToken: state.accessToken,
              refreshToken: state.refreshToken,
            };
          }
          return persisted;
        },
      },
    ),
  ),
);

/** Vanilla store API (non-hook name) for useStoreWithEqualityFn. */
export const storeApi = useStore;
