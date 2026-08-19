/**
 * Zustand Store - Application-wide state management
 *
 * Persistence Strategy:
 * ====================
 * Persistence is an explicit ALLOWLIST: only fields named in PERSISTED_KEYS
 * (below RootState) enter the MMKV blob. Every other field is transient by
 * default — a new store field simply doesn't persist until it's added to the
 * list.
 *
 * Why an allowlist: the previous partialize persisted everything that wasn't
 * explicitly destructured out, so derived/session state kept leaking into the
 * blob and overriding fresh defaults on hydration — `apiReachable` froze the
 * app in a permanent "server unreachable" state (v11), the env-derived
 * telemetry flags silently killed log shipping (v12), and `isHydrated` +
 * auth/scanner lifecycle flags rode along undetected (v13). Default-transient
 * fails SAFE: forgetting to classify a field means a setting doesn't survive
 * restart (visible, one-line fix, no migration) instead of a stale persisted
 * value silently overriding code defaults forever.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware';

// Enable Immer MapSet plugin for performance slice
enableMapSet();
import { createAuthSlice, AuthState } from './slices/authSlice';
import {
  applyThemePreferenceToRuntime,
  createPreferencesSlice,
  PreferencesState,
} from './slices/preferencesSlice';
import { FontScalePreference } from './slices/preferenceTypes';
import {
  BarcodeScannerState,
  createBarcodeScannerSlice,
} from './slices/barcodeScannerSlice';
import { createAppSlice, AppState } from './slices/appSlice';
import {
  createNotificationSlice,
  NotificationState,
} from './slices/notificationSlice';
import { createUISlice, UIState } from './slices/uiSlice';
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
import { zustandStorage, STORAGE_KEY, isRecoveryStorage } from '#/storage/mmkv';
import {
  loadSessionTokens,
  pickFresherSessionTokens,
  type SessionTokenLoadResult,
} from '#/storage/keychain';
import { logger } from '#/utils/environment';
// Type-only — erased at runtime, so it does NOT pull the telemetry→useStore
// cycle into the module graph. The value is loaded via deferred `require` below.
import type { ErrorService } from '#/services/errorService';

/**
 * Final step of persist hydration: pull session tokens out of the keychain
 * (their persistence tier — see partialize) and only then flip `isHydrated`,
 * so the first authenticated paint sees the session.
 *
 * The MMKV blob keeps a fallback copy of the pair until the keychain copy is
 * confirmed (`sessionTokensInKeychain`, checked in partialize):
 * - 'ok'     → keychain holds the pair; the MMKV copy can be dropped.
 * - 'absent' → installs that predate keychain token storage migrate their
 *              MMKV pair here; it is dropped only once the write confirms.
 * - 'error'  → keychain unreadable after retries; any MMKV-restored session
 *              stays in place and nothing is dropped this launch.
 */
const hydrateSessionTokensThenFinish = async (
  state: RootState | undefined,
): Promise<void> => {
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
    // setTokens schedules the proactive refresh and write-throughs to the
    // keychain. The keychain pair is confirmed now; the MMKV pair self-heals the
    // keychain via that write-through, flipping the flag once it confirms.
    state?.setTokens(tokens);
    if (tokens === result.tokens) {
      state?.setSessionTokensInKeychain(true);
    }
  } else if (state?.accessToken && state?.refreshToken) {
    // MMKV fallback copy ('absent': install predates keychain storage;
    // 'error': keychain unreadable after retries). Running the pair through
    // setTokens schedules the proactive refresh and write-through persists
    // to the keychain — `sessionTokensInKeychain` flips only when that
    // write confirms, so partialize keeps the MMKV copy until then.
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
 * Persist rehydration listener, extracted so it can be unit-tested directly —
 * the inline persist closure can't be exercised in isolation.
 *
 * Success: sync theme / language / session / home-selection / offline mode from
 * the restored blob; `hydrateSessionTokensThenFinish` then flips `isHydrated`.
 *
 * Error: the persisted blob couldn't be restored. Report it to telemetry and
 * still flip `isHydrated` so the app boots on defaults instead of hanging on
 * the loading screen forever (RootNavigator gates first paint on `isHydrated`).
 * `errorService` is lazy-imported to avoid the telemetry→`useStore` import
 * cycle at module load — the same reason the cold-start metric below is lazy.
 */
export const handleStoreRehydration = (
  state: RootState | undefined,
  error: unknown,
): void => {
  if (error) {
    // Recover first so the app always boots on defaults, even if reporting
    // throws — otherwise RootNavigator hangs on the loading screen forever.
    useStore.getState().setHydrated(true);
    // Deferred `require` (not a static import) keeps telemetry — which imports
    // `useStore` — out of the module-load cycle, while staying synchronous.
    const { errorService } = require('#/services/errorService') as {
      errorService: ErrorService;
    };
    errorService.reportError(error, { operation: 'storeHydration' });
    return;
  }

  // Sync the rehydrated theme preference to UnistylesRuntime
  // BEFORE flipping `isHydrated`. This makes the persist layer
  // the single source of truth for cold-boot theme application,
  // so React hooks never need a side-effect to "catch up".
  if (state?.theme) {
    applyThemePreferenceToRuntime(state.theme);
  }

  // Sync the rehydrated UI language to i18next BEFORE flipping
  // `isHydrated`, so the first paint already shows the user's
  // preferred language instead of the bundled default ('en').
  // Lazy-imported because i18n/config side-effects on load — we
  // want to avoid pulling it into the persist closure.
  if (state?.language && state.language !== 'en') {
    import('#/i18n/config').then(({ getI18n }) => {
      void getI18n().changeLanguage(state.language);
    });
  }

  // Load session tokens from the keychain BEFORE flipping
  // `isHydrated`, so auth-dependent navigation sees the session on
  // first paint. Tokens are excluded from partialize — the
  // keychain (not MMKV) is their persistence tier.
  void hydrateSessionTokensThenFinish(state);

  // Cold-start telemetry: time from JS bundle entry to Zustand
  // hydration callback firing. Captures MMKV decrypt + JSON parse +
  // store rehydrate cost. Imported lazily to avoid pulling
  // telemetry into the persist closure during module load.
  const startTs = (globalThis as { __APP_START_TIMESTAMP?: number })
    .__APP_START_TIMESTAMP;
  if (startTs) {
    import('#services/telemetry').then(({ Telemetry }) => {
      Telemetry.histogram('app_zustand_hydration_ms', Date.now() - startTs);
    });
  }

  // Clean up orphaned notifications on app startup
  // This ensures persisted notifications are filtered correctly
  // after app updates or context changes.
  // Optional-called like the setters below: production has reported
  // `cleanupOrphanedSubscriptions is not a function` here, and an exception
  // thrown at this point aborts the rest of the callback — the persisted
  // home/pantry fast path and the offline-mode hydration below would never
  // run for that launch.
  state?.cleanupOrphanedSubscriptions?.();

  // PERF: If persisted home+pantry IDs exist, mark ready immediately
  // so usePantryQuery fires on the FIRST render instead of waiting
  // for useDefaultHome's effect (which runs after render).
  // Safe because both cache partitions are now restored synchronously
  // in initializeClient() before React mounts.
  if (state?.selectedHomeId && state?.selectedPantryId) {
    state?.setIsHomeSelectionReady(true);
  }

  // Hydrate offlineModeEnabled from MMKV. Kept outside Zustand
  // persist (see partialize) so we can read the user's last
  // setting before the GetUserSettings query resolves.
  if (state?.setOfflineModeEnabled) {
    hydrateOfflineModeFromStorage(state.setOfflineModeEnabled);
  }
};

// Add reset manager interface to root state
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

// Add navigation state machine interface
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
  NotificationState &
  BarcodeScannerState &
  UIState &
  TelemetryState &
  NetworkState &
  // PerformanceState moved to separate store
  ResetManagerState &
  NavigationStateManagerState;

/** Non-function fields of the store — the keys persistence has to classify. */
type StateDataKey = {
  [K in keyof RootState]-?: RootState[K] extends (...args: never[]) => unknown
    ? never
    : K;
}[keyof RootState];

/**
 * Literal-preserving list builder: the `K extends StateDataKey` constraint is
 * a union of string literals, so TypeScript infers the arguments as literal
 * types (no `as const` needed) and rejects any key that isn't a store data
 * field.
 */
const classifyKeys = <K extends StateDataKey>(
  ...keys: readonly K[]
): readonly K[] => keys;

/**
 * The persistence allowlist — the ONLY fields written to the MMKV blob.
 * Everything else in RootState is transient by default and re-derived fresh
 * each launch. Add a field here only when it's genuine user data or a user
 * choice; never add derived/session/lifecycle state (see the v13 migration
 * note for the three bugs that pattern caused). The exact blob shape is
 * locked by src/store/__tests__/persistOptions.test.ts.
 */
const PERSISTED_KEYS = classifyKeys(
  // Auth — the user object and login preferences. The session token pair
  // lives in the keychain; partialize conditionally re-adds it below while
  // the keychain copy is unconfirmed.
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

  // Notification inbox
  'notifications',
  'unreadCount',
  'urgentCount',

  // Scanner history (the live scan/search state is transient)
  'recentlyScanned',

  // Offline reference caches + freshness stamps (autocomplete warmth)
  'cachedUnits',
  'cachedCategories',
  'cachedBrands',
  'cachedStores',
  // Seen-items LRU — persisted so offline cold-start item autocomplete keeps
  // its fallback suggestions (no freshness stamp: it's a usage LRU, not a
  // fetched catalog slice).
  'cachedItemSuggestions',
  'lastFetchedAt',
  'lastUnitsFetchedAt',
  'lastCategoriesFetchedAt',
  'lastBrandsFetchedAt',
  'lastStoresFetchedAt',

  // Telemetry: the one real user choice (the feature flags are env-derived)
  'userConsent',
);

type PersistedKey = (typeof PERSISTED_KEYS)[number];

/**
 * The persisted-key allowlist as a queryable set — used by the v13 migration
 * sweep and exported (via PERSISTED_KEYS) to the persistence tests.
 */
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
        // Enable for debugging state changes
        // logger((set, get, store) => {
        (set, get, store) => {
          // Create the reset manager
          const resetManager = createResetManager(set, get);

          // Create navigation state manager
          const navigationStateManager: NavigationStateManagerState = {
            initiateLogout: () => {
              set(state => {
                state.isLoggingOut = true;
              });
              return true; // Success
            },
            completeLogout: () => {
              set(state => {
                state.isLoggingOut = false;
              });
              return true; // Success
            },
          };

          return {
            ...createAuthSlice(set, get, store),
            ...createPreferencesSlice(set, get, store),
            ...createAppSlice(set, get, store),
            ...createNavigationSlice(set, get, store),
            ...createBarcodeScannerSlice(set, get, store),
            ...createNotificationSlice(set, get, store),
            ...createUISlice(set, get, store),
            ...createTelemetrySlice(set, get, store),
            ...createNetworkSlice(set, get, store),
            // createPerformanceSlice moved to separate store (performanceStore.ts)
            // Add reset manager methods to the store
            ...resetManager,
            // Add navigation state manager methods
            ...navigationStateManager,
          };
        },
        // ),
      ),
      {
        name: STORAGE_KEY,
        version: 13,
        storage: createJSONStorage(() => zustandStorage),
        // Do store migrations here
        migrate: (persistedState: unknown, version: number) => {
          // Migration v8 → v9: Extract nested profile fields into top-level user fields.
          // Existing users have user.profile.firstName etc. from the old schema, but
          // the greeting reads user.firstName / user.name directly.
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

          // Migration v9 → v10: the 'system' font scale option was removed
          // (it was a redundant 1.0 alias for the new default 'md', since
          // allowFontScaling already follows the OS size). Remap any persisted
          // value so it resolves to a valid FontScalePreference member.
          if (version < 10) {
            const state = persistedState as {
              fontScalePreference?: string;
            } | null;
            if (state?.fontScalePreference === 'system') {
              state.fontScalePreference = FontScalePreference.MD;
            }
          }

          // Migration → v13: partialize was inverted from a blocklist to the
          // PERSISTED_KEYS allowlist after derived/session state kept leaking
          // into the blob and overriding fresh defaults on hydration — the
          // bug struck three times: `apiReachable` froze the app in a
          // permanent "server unreachable" state (v11), the env-derived
          // telemetry flags baked in a stale `enableLogs: false` that
          // silently killed log shipping (v12), and `isHydrated` plus
          // auth/scanner lifecycle flags rode along undetected (v13). One
          // sweep enforces the allowlist on every older blob, subsuming the
          // per-key v11/v12 deletes. The keychain-fallback token pair is the
          // only sanctioned passenger outside the allowlist.
          if (version < 13) {
            const state = persistedState as Record<string, unknown> | null;
            if (state) {
              for (const key of Object.keys(state)) {
                if (!PERSISTED_KEY_SET.has(key) && !BLOB_ONLY_KEYS.has(key)) {
                  delete state[key];
                }
              }
            }
          }

          return persistedState;
        },
        onRehydrateStorage: () => handleStoreRehydration,
        skipHydration: false,
        partialize: state => {
          // Explicit allowlist — see PERSISTED_KEYS / TRANSIENT_KEYS above.
          // Only listed data fields enter the blob; actions and unclassified
          // keys can't leak in (the old spread serialized ~125 functions per
          // write just for JSON.stringify to drop them).
          const persisted = pickPersisted(state);

          // Losing both token tiers logs the user out, so the pair stays in
          // the MMKV blob while the keychain copy is unconfirmed (migration
          // writes, transient keychain failures). Never on the recovery
          // instance, though — that file is unencrypted at rest, so persisting
          // the tokens there would defeat the fail-closed contract. In that
          // doubly-degraded case the user re-logs in on next launch.
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

// Vanilla store API reference (non-hook name) for useStoreWithEqualityFn
export const storeApi = useStore;

// Standalone stores are exported directly from their own files:
// import { useRecipeSuggestionsStore } from '#store/useRecipeSuggestionsStore';
