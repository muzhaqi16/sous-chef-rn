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

import {createAppSlice, AppState} from './slices/appSlice';

import {logger} from './logger';
import {zustandStorage} from '../storage/mmkv';

export const STORAGE_KEY = 'sous-chef-storage';

export type RootState = AuthState & PreferencesState & AppState;

export const useStore = create<RootState>()(
  subscribeWithSelector(
    persist(
      immer(
        logger((...a) => ({
          ...createAuthSlice(...a),
          ...createPreferencesSlice(...a),
          ...createAppSlice(...a),
        })),
      ),
      {
        name: STORAGE_KEY,
        version: 3,
        storage: createJSONStorage(() => zustandStorage),
        onRehydrateStorage: state => {
          console.log('hydration starts');
          return (state, error) => {
            if (error) {
              console.log('an error happened during hydration', error);
            } else {
              state?.setHydrated(true);
              console.log('hydration finished');
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
