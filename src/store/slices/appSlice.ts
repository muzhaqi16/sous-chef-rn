import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {zustandStorage, STORAGE_KEY} from '../../storage/mmkv';

interface Unit {
  id: string;
  name: string;
  symbol: string;
  abbreviation?: string;
}

export interface AppState {
  isHydrated: boolean;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isLoggingOut: boolean; // Global logout state
  cachedUnits: Unit[];

  setHydrated: (flag: boolean) => void;
  setLoading: (flag: boolean) => void;
  setFetching: (flag: boolean) => void;
  setError: (flag: boolean) => void;
  setLoggingOut: (flag: boolean) => void;
  setCachedUnits: (units: Unit[]) => void;
  reset: () => void;
}

export const initialAppState = {
  isHydrated: false,
  isLoading: false,
  isError: false,
  isFetching: false,
  isLoggingOut: false,
  cachedUnits: [],
};

export const createAppSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AppState
> = set => ({
  ...initialAppState,

  setHydrated: flag => set({isHydrated: flag}),
  setLoading: flag => set({isLoading: flag}),
  setFetching: flag => set({isFetching: flag}),
  setError: flag => set({isError: flag}),
  setLoggingOut: flag => set({isLoggingOut: flag}),
  setCachedUnits: units => set({cachedUnits: units}),

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
