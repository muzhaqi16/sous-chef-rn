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
  createPreferencesSlice,
  PreferencesState,
} from './slices/preferencesSlice';
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
import { createNetworkSlice, NetworkState } from './slices/networkSlice';
// Performance slice moved to separate store (performanceStore.ts) to prevent re-render loops
// import { createPerformanceSlice, PerformanceState } from './slices/performanceSlice';
// import {logger} from './logger';
import { zustandStorage, STORAGE_KEY } from '#/storage/mmkv';

// Add reset manager interface to root state
interface ResetManagerState {
  resetStore: (
    options: ResetOptions | keyof typeof RESET_SCENARIOS,
  ) => Promise<void>;
  logout: () => Promise<void>;
  fullReset: () => Promise<void>;
  sessionExpired: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  tokenRefreshFailed: (clearCache?: boolean) => Promise<void>;
}

// Add navigation state machine interface
interface NavigationStateManagerState {
  initiateLogout: () => boolean;
  completeLogout: () => boolean;
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
        version: 5,
        storage: createJSONStorage(() => zustandStorage),
        // Do store migrations here
        migrate: (persistedState: any, version: number) => {
          // Migration from version 4 to 5: Remove persisted network state
          if (version === 4) {
            /* eslint-disable @typescript-eslint/no-unused-vars */
            const {
              isOnline,
              isInternetReachable,
              networkType,
              lastOnlineTime,
              lastOfflineTime,
              ...rest
            } = persistedState || {};
            /* eslint-enable @typescript-eslint/no-unused-vars */

            return rest;
          }

          return persistedState;
        },
        onRehydrateStorage: () => {
          return (state, error) => {
            if (error) {
              console.log('An error happened during hydration', error);
            } else {
              // Mark store as hydrated
              state?.setHydrated(true);
            }
          };
        },
        skipHydration: false,
        partialize: state => {
          // Filter out non-persisted state slices here
          // Split state into persistent and transient parts

          /* eslint-disable @typescript-eslint/no-unused-vars */
          const {
            // ========== TRANSIENT STATE (do not persist) ==========

            // Network state (always detect fresh on app start)
            isOnline,
            isInternetReachable,
            networkType,
            lastOnlineTime,
            lastOfflineTime,

            // UI state (temporary, session-only)
            bottomSheetVisible,
            bottomSheetIndex,
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

            // Navigation transient state
            onBoardingStep, // Restart onboarding flow on app restart
            pendingDeepLinkAction, // Deep link actions should not persist

            // Logout state (session-only flag)
            isLoggingOut,

            ...persistedState
          } = state;
          // ========== PERSISTENT STATE (everything else) ==========

          return persistedState;
        },
      },
    ),
  ),
);
