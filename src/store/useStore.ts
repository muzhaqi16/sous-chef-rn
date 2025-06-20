import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {ShoppingListState, createShoppingListSlice} from './shoppingListSlice';
import {AuthState, createAuthSlice} from './authSlice';
import {PreferencesState, createPreferencesSlice} from './preferencesSlice';
import {createItemsSlice, ItemsState} from './itemsSlice';
import {zustandStorage} from '../storage/mmkv';
import {logger} from './logger';

type State = ShoppingListState &
  AuthState &
  PreferencesState &
  ItemsState & {
    // our hydration slice
    isHydrated: boolean;
    setHydrated: (flag: boolean) => void;
  };
type PersistedState = Omit<State, 'isHydrated' | 'setHydrated'>;

export const useStore = create<State>()(
  persist(
    logger((...a) => {
      // Initial state
      const [set] = a;

      return {
        ...createShoppingListSlice(...a),
        ...createAuthSlice(...a),
        ...createPreferencesSlice(...a),
        ...createItemsSlice(...a),
        isHydrated: false,
        setHydrated: (flag: boolean) => set({isHydrated: flag}),
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
