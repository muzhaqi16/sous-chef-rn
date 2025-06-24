import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {ShoppingListState, createShoppingListSlice} from './shoppingListSlice';
import {AuthState, createAuthSlice} from './authSlice';
import {PreferencesState, createPreferencesSlice} from './preferencesSlice';
import {createProfileSlice, ProfileState} from './profileSlice';
import {createItemsSlice, ItemsState} from './itemsSlice';
import {zustandStorage} from '../storage/mmkv';
import {logger} from './logger';

export type RootState = ShoppingListState &
  AuthState &
  ProfileState &
  PreferencesState &
  ItemsState & {
    // our hydration slice
    isHydrated: boolean;
    setHydrated: (flag: boolean) => void;
    reset: () => void;
  };

export const useStore = create<RootState>()(
  persist(
    logger((...a) => {
      // Initial state
      const [set] = a;

      return {
        ...createShoppingListSlice(...a),
        ...createAuthSlice(...a),
        ...createProfileSlice(...a),
        ...createPreferencesSlice(...a),
        ...createItemsSlice(...a),
        isHydrated: false,
        setHydrated: (flag: boolean) => set({isHydrated: flag}),
        reset: () => {
          zustandStorage.removeItem('sous-chef-storage'); // clear the storage
          // Reset the state to initial values
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            defaultShoppingList: null,
            shoppingLists: [],
            items: [],
            userProfile: null,
            theme: 'light',
            onBoardingCompleted: false,
          });
        },
      };
    }),
    {
      name: 'sous-chef-storage', // unique name
      version: 2, // number (or a string)
      // https://github.com/pmndrs/zustand/blob/main/docs/integrations/persisting-store-data.md
      storage: createJSONStorage(() => zustandStorage), // use zustandStorage as the storage
      // this runs *after* the storage has been rehydrated
      onRehydrateStorage: state => {
        console.log('hydration starts');

        // optional
        return (state, error) => {
          if (error) {
            console.log('an error happened during hydration', error);
          } else {
            state?.setHydrated(true);
            console.log('hydration finished');
          }
        };
      },
      skipHydration: false, // (optional) you can skip the initial hydration https://zustand.docs.pmnd.rs/integrations/persisting-store-data#skiphydration
      // Enables you to pick some of the state's fields to be stored in the storage.
      partialize: state =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['_hasHydrated'].includes(key),
          ),
        ),
    },
  ),
);
