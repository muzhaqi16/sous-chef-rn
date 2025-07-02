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
import {createProfileSlice, ProfileState} from './slices/profileSlice';
import {createItemsSlice, ItemsState} from './slices/entities/itemsSlice';
import {createPantrySlice, PantryState} from './slices/pantrySlice';
import {createShoppingListSlice, ShoppingListState} from './slices/listsSlice';
import {
  createShoppingListItemSlice,
  ShoppingListItemState,
} from './slices/shoppingListItemSlice';
import {createAppSlice, AppState} from './slices/appSlice';
import {
  createConnectivitySlice,
  ConnectivityState,
} from './slices/connectivitySlice';
import {createOfflineSlice, OfflineState} from './slices/offlineSlice';
import {logger} from './logger';
import {zustandStorage} from '../storage/mmkv';

export const STORAGE_KEY = 'sous-chef-storage';

export type RootState = AuthState &
  PreferencesState &
  ProfileState &
  ItemsState &
  PantryState &
  ShoppingListState &
  ShoppingListItemState &
  ConnectivityState &
  OfflineState &
  AppState;

export const useStore = create<RootState>()(
  subscribeWithSelector(
    persist(
      immer(
        logger((...a) => ({
          ...createAuthSlice(...a),
          ...createPreferencesSlice(...a),
          ...createProfileSlice(...a),
          ...createItemsSlice(...a),
          ...createPantrySlice(...a),
          ...createShoppingListSlice(...a),
          ...createShoppingListItemSlice(...a),
          ...createAppSlice(...a),
          ...createConnectivitySlice(...a),
          ...createOfflineSlice(...a),
        })),
      ),
      {
        name: STORAGE_KEY,
        version: 2,
        storage: createJSONStorage(() => zustandStorage),
        onRehydrateStorage: state => {
          return (state, error) => {
            if (!error) state?.setHydrated(true);
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
