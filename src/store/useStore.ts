import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {ShoppingListState, createShoppingListSlice} from './shoppingListSlice';
import {AuthState, createAuthSlice} from './authSlice';
import {PreferencesState, createPreferencesSlice} from './preferencesSlice';
import {createItemsSlice, ItemsState} from './itemsSlice';
import {zustandStorage} from '../storage/mmkv';

export const useStore = create(
  persist<ShoppingListState & AuthState & PreferencesState & ItemsState>(
    (...a) => ({
      ...createShoppingListSlice(...a),
      ...createAuthSlice(...a),
      ...createPreferencesSlice(...a),
      ...createItemsSlice(...a),
    }),
    {
      name: 'sous-chef-storage', // unique name
      // https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md
      storage: createJSONStorage(() => zustandStorage), // use zustandStorage as the storage
    },
  ),
);
