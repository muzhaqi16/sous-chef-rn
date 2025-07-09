import {StateCreator} from 'zustand';
import {RootState} from '../index';
import uuid from 'react-native-uuid';

export type Home = {
  id: string;
  name: string;
  createdAt: string;
  isOffline: boolean;
};

export interface HomeState {
  homeById: Record<string, Home>;
  homeId: string | null;
  initializeOfflineHome: () => void;
  setHome: (home: Home) => void;
  clearHome: () => void;
}

export const initialHomeState: HomeState = {
  homeById: {},
  homeId: null,
  initializeOfflineHome: () => {},
  setHome: () => {},
  clearHome: () => {},
};

export const createHomeSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  HomeState
> = set => ({
  homeById: {},
  homeId: null,

  initializeOfflineHome: () => {
    const id = uuid.v4().toString();
    const offlineHome: Home = {
      id,
      name: 'My Home',
      createdAt: new Date().toISOString(),
      isOffline: true,
    };
    set(state => {
      state.homeById[id] = offlineHome;
      state.homeId = id;
    });
  },

  setHome: home =>
    set(state => {
      state.homeById[home.id] = home;
      state.homeId = home.id;
    }),

  clearHome: () =>
    set(state => {
      if (state.homeId) delete state.homeById[state.homeId];
      state.homeId = null;
    }),
});
