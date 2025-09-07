import {create} from 'zustand';
import {immer} from 'zustand/middleware/immer';
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware';
import {createAuthSlice, AuthState} from './slices/authSlice';
import {
  createPreferencesSlice,
  PreferencesState,
} from './slices/preferencesSlice';
import {
  BarcodeScannerState,
  createBarcodeScannerSlice,
} from './slices/barcodeScannerSlice';
import {createAppSlice, AppState} from './slices/appSlice';
import {
  createNotificationSlice,
  NotificationState,
} from './slices/notificationSlice';
import {
  createResetManager,
  ResetOptions,
  RESET_SCENARIOS,
} from './resetManager';
// import {logger} from './logger';
import {zustandStorage, STORAGE_KEY} from '#/storage/mmkv';

// Add reset manager interface to root state
interface ResetManagerState {
  resetStore: (
    options: ResetOptions | keyof typeof RESET_SCENARIOS,
  ) => Promise<void>;
  logout: () => Promise<void>;
  fullReset: () => Promise<void>;
  sessionExpired: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export type RootState = AuthState &
  PreferencesState &
  AppState &
  NotificationState &
  BarcodeScannerState &
  ResetManagerState;

export const useStore = create<RootState>()(
  subscribeWithSelector(
    persist(
      immer(
        // Enable for debugging state changes
        // logger((set, get, store) => {
        (set, get, store) => {
          // Create the reset manager
          const resetManager = createResetManager(set, get);

          return {
            ...createAuthSlice(set, get, store),
            ...createPreferencesSlice(set, get, store),
            ...createAppSlice(set, get, store),
            ...createBarcodeScannerSlice(set, get, store),
            ...createNotificationSlice(set, get, store),
            // Add reset manager methods to the store
            ...resetManager,
          };
        },
        // ),
      ),
      {
        name: STORAGE_KEY,
        version: 3,
        storage: createJSONStorage(() => zustandStorage),
        onRehydrateStorage: state => {
          console.log('Store hydration starts');
          return (state, error) => {
            if (error) {
              console.log('An error happened during hydration', error);
            } else {
              state?.setHydrated(true);
              console.log('Store hydration finished');
            }
          };
        },
        skipHydration: false,
        partialize: state => {
          // exclude ephemeral UI flags if desired
          const {isLoading, isError, isFetching, ...rest} = state;
          return rest;
        },
      },
    ),
  ),
);
