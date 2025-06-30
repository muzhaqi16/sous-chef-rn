import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
export const STORAGE_KEY = 'sous-chef-storage';
// Import all slices from index file
import {
  type RootState,
  createShoppingListSlice,
  createAuthSlice,
  createPreferencesSlice,
  createProfileSlice,
  createItemsSlice,
  createPantrySlice,
  createAppSlice,
  createShoppingListItemSlice,
} from './';
// State is saved in MMKV storage locally
import {zustandStorage} from '../storage/mmkv';
// Import the logger middleware, used for debugging
import {logger} from './logger';

export const useStore = create<RootState>()(
  persist(
    logger((...a) => {
      // Extract the set function from the arguments
      const [set] = a;

      return {
        ...createShoppingListSlice(...a),
        ...createAuthSlice(...a),
        ...createProfileSlice(...a),
        ...createPreferencesSlice(...a),
        ...createItemsSlice(...a),
        ...createPantrySlice(...a),
        ...createAppSlice(...a),
        ...createShoppingListItemSlice(...a),
      };
    }),
    {
      name: STORAGE_KEY, // unique name
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
