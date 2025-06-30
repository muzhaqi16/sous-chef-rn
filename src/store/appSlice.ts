import {StateCreator} from 'zustand';
import {RootState} from '.';
import {STORAGE_KEY} from './useStore';
import {zustandStorage} from '../storage/mmkv';

export interface AppState {
  isHydrated: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  setHydrated: (flag: boolean) => void;
  setLoading: (flag: boolean) => void;
  setFetching: (flag: boolean) => void;
  setError: (flag: boolean) => void;
  reset: () => void;
}

export const initialAppState = {
  isHydrated: false,
  isLoading: false,
  isError: false,
  isFetching: false,
};

export const createAppSlice: StateCreator<RootState, [], [], AppState> = (
  set,
  get,
) => ({
  ...initialAppState,
  setHydrated: (flag: boolean) => set({isHydrated: flag}),
  setLoading: flag => set({isLoading: flag}),
  setFetching: flag => set({isFetching: flag}),
  setError: flag => set({isError: flag}),
  reset: () => {
    zustandStorage.removeItem(STORAGE_KEY); // clear the storage
    // Reset the state to initial values
    set(initialAppState);
    set({
      shoppingListItems: [],
      pantryItems: [],
      shoppingLists: [],
      user: null,
      accessToken: null,
    });
    set({
      isHydrated: true,
    });
  },
});
