import { StateCreator } from 'zustand';
import { RootState } from '../index';

export interface NetworkState {
  // Network status
  isOnline: boolean;
  isInternetReachable: boolean | null;
  networkType: string | null;
  lastOnlineTime: number | null;
  lastOfflineTime: number | null;

  // Actions
  setNetworkStatus: (status: {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    networkType: string | null;
  }) => void;
  setOnline: () => void;
  setOffline: () => void;
}

const initialNetworkState = {
  isOnline: true, // Assume online until proven otherwise (per Apollo best practices)
  isInternetReachable: null,
  networkType: null,
  lastOnlineTime: null,
  lastOfflineTime: null,
};

export const createNetworkSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  NetworkState
> = (set, get) => ({
  ...initialNetworkState,

  setNetworkStatus: status => {
    set(state => {
      const wasOnline = state.isOnline;
      state.isOnline = status.isOnline;
      state.isInternetReachable = status.isInternetReachable;
      state.networkType = status.networkType;

      // Track transition timestamps
      if (!wasOnline && status.isOnline) {
        state.lastOnlineTime = Date.now();
      } else if (wasOnline && !status.isOnline) {
        state.lastOfflineTime = Date.now();
      }
    });
  },

  setOnline: () => {
    const state = get();
    if (!state.isOnline) {
      set(draft => {
        draft.isOnline = true;
        draft.lastOnlineTime = Date.now();
      });
    }
  },

  setOffline: () => {
    const state = get();
    if (state.isOnline) {
      set(draft => {
        draft.isOnline = false;
        draft.lastOfflineTime = Date.now();
      });
    }
  },
});
