import {StateCreator} from 'zustand';
import {RootState, STORAGE_KEY} from '../index';
import {zustandStorage} from '../../storage/mmkv';

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

export const createAppSlice: StateCreator<
  RootState,
  [],
  [],
  AppState
> = set => ({
  ...initialAppState,

  setHydrated: flag => set({isHydrated: flag}),
  setLoading: flag => set({isLoading: flag}),
  setFetching: flag => set({isFetching: flag}),
  setError: flag => set({isError: flag}),

  reset: () => {
    zustandStorage.removeItem(STORAGE_KEY);
    set(initialAppState);
    set({
      itemsById: {},
      itemIds: [],
      pantryById: {},
      pantryIds: [],
      listById: {},
      listIds: [],
      itemsByList: {},
      user: null,
      accessToken: null,
      refreshToken: null,
    } as unknown as Partial<RootState>);
    set({isHydrated: true});
  },
});
