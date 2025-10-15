import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware';
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
              console.log(
                '🔄 Store: Logout initiated - setting global logout state',
              );
              set(state => {
                state.isLoggingOut = true;
              });
              return true; // Success
            },
            completeLogout: () => {
              console.log(
                '🔄 Store: Logout completed - clearing global logout state',
              );
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
        version: 3,
        storage: createJSONStorage(() => zustandStorage),
        onRehydrateStorage: () => {
          return (state, error) => {
            if (error) {
              console.log('An error happened during hydration', error);
            } else {
              console.log('🏪 Store hydrated successfully');
              // Mark store as hydrated
              state?.setHydrated(true);
            }
          };
        },
        skipHydration: false,
        partialize: state => {
          // Filter out non-persisted state slices here
          // Do not persist UI state or navigation state

          /* eslint-disable @typescript-eslint/no-unused-vars */
          const {
            // Exclude UI state that should not persist (intentionally unused)
            bottomSheetVisible,
            bottomSheetIndex,
            globalLoading,
            isLoading,
            isError,
            isFetching,
            ...persistedState
          } = state;
          /* eslint-enable @typescript-eslint/no-unused-vars */

          return persistedState;
        },
      },
    ),
  ),
);
