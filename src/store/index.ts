/**
 * Zustand Store - Application-wide state management
 *
 * Persistence Strategy:
 * ====================
 * The store is split into PERSISTENT and TRANSIENT state:
 *
 * PERSISTENT (saved to MMKV):
 * - Auth tokens, user data (authSlice)
 * - User preferences, theme, language (preferencesSlice)
 * - Selected IDs (home, pantry, shopping list)
 * - User navigation history and progress
 * - Telemetry settings
 * - Notification preferences
 *
 * TRANSIENT (session-only, not persisted):
 * - Network state (isOnline, networkType) - always detect fresh
 * - UI state (modals, forms, toasts, loading flags)
 * - Current onboarding step - restart flow on app restart
 * - Pending deep link actions - temporary
 * - isLoggingOut flag - session-only
 *
 * This split prevents unnecessary disk writes and ensures fresh
 * state for ephemeral UI concerns while preserving user data.
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
import { zustandStorage, STORAGE_KEY } from '#/storage/mmkv';
import {
  loadSessionTokens,
  type SessionTokenLoadResult,
} from '#/storage/keychain';
import { logger } from '#/utils/environment';

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
    // setTokens also schedules the proactive refresh for the restored
    // session; its keychain write-through is skipped as an unchanged pair.
    state?.setTokens(result.tokens);
    state?.setSessionTokensInKeychain(true);
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

// Add reset manager interface to root state
interface ResetManagerState {
  resetStore: (
    options: ResetOptions | keyof typeof RESET_SCENARIOS,
  ) => Promise<void>;
  logout: () => Promise<void>;
  fullReset: () => Promise<void>;
  sessionExpired: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
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
        version: 10,
        storage: createJSONStorage(() => zustandStorage),
        // Do store migrations here
        migrate: (persistedState: unknown, version: number) => {
          // Migration from version 6 to 7: Clear home initialization flags
          // These are now transient and should not be persisted
          if (version < 7) {
            // Do something for v7 if needed
          }

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

          return persistedState;
        },
        onRehydrateStorage: () => {
          return (state, error) => {
            if (error) {
              console.error('An error happened during hydration', error);
            } else {
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
                  Telemetry.histogram(
                    'app_zustand_hydration_ms',
                    Date.now() - startTs,
                  );
                });
              }

              // Clean up orphaned notifications on app startup
              // This ensures persisted notifications are filtered correctly
              // after app updates or context changes
              state?.cleanupOrphanedSubscriptions();

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
            }
          };
        },
        skipHydration: false,
        partialize: state => {
          // Filter out non-persisted state slices here
          // Split state into persistent and transient parts

          const {
            // ========== TRANSIENT STATE (do not persist) ==========

            // Network state (always detect fresh on app start)
            isOnline,
            isInternetReachable,
            networkType,
            lastOnlineTime,
            lastOfflineTime,
            needsTokenRefresh,
            offlineModeEnabled, // Hydrated from MMKV in onRehydrateStorage; setter writes through to MMKV

            // UI state (temporary, session-only)
            bottomSheetVisible,
            bottomSheetIndex,
            scannerSheetVisible,
            scannerSheetIndex,
            globalLoading,
            isLoading,
            isError,
            isFetching,
            activeFormId,
            formData,
            globalSearchQuery,
            activeFilters,
            toastMessage,
            toastType,
            pendingPantryScrollToTop,
            tutorialResetGeneration,

            // Navigation transient state
            onBoardingStep, // Restart onboarding flow on app restart
            pendingDeepLinkAction, // Deep link actions should not persist

            // Home initialization flags (session-only - must re-fetch on app restart)
            // These ensure GetHomes query runs fresh to populate Apollo cache
            hasInitializedHomeData,
            isHomeSelectionReady,

            // Logout state (session-only flag)
            isLoggingOut,

            // Session tokens (keychain-persisted; loaded in
            // hydrateSessionTokensThenFinish, written through in the
            // authSlice setters). Conditionally re-added below: the MMKV
            // blob keeps a fallback copy until the keychain copy confirms.
            accessToken,
            refreshToken,
            sessionTokensInKeychain,

            // Seen-items LRU: a within-session warmth cache for catalog item
            // autocomplete. Kept transient so it isn't serialized into MMKV on
            // every search result (each ItemSuggestion is large). The persisted
            // reference caches (cachedCategories/Brands/Stores, units) cover
            // offline autocomplete across cold starts.
            cachedItemSuggestions,

            // Passwords (must not persist to MMKV — keychain only)
            registrationPassword,
            postLoginCredentials,

            // Auth service transient loading state
            authIsLoading,
            authIsLoadingCredentials,

            // Notification transient state (session-only buffer for race condition handling)
            pendingExpirationLinks,

            ...persistedState
          } = state;
          // ========== PERSISTENT STATE (everything else) ==========

          // Losing both token tiers logs the user out, so the pair stays in
          // the MMKV blob while the keychain copy is unconfirmed (migration
          // writes, transient keychain failures).
          if (!sessionTokensInKeychain && accessToken && refreshToken) {
            return { ...persistedState, accessToken, refreshToken };
          }
          return persistedState;
        },
      },
    ),
  ),
);

// Vanilla store API reference (non-hook name) for useStoreWithEqualityFn
export const storeApi = useStore;

// Standalone stores are exported directly from their own files:
// import { useRecipeSuggestionsStore } from '#store/useRecipeSuggestionsStore';
