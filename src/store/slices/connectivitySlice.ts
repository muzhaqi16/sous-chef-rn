import {StateCreator} from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import {RootState} from '../index';

export interface ConnectivityState {
  isOnline: boolean;
}

export const createConnectivitySlice: StateCreator<
  RootState,
  [],
  [],
  ConnectivityState
> = (set, get) => {
  // 1) Seed initial state from NetInfo.fetch()
  NetInfo.fetch().then(state => {
    set({isOnline: state.isConnected ?? false});
  });

  // 2) Subscribe to changes and trigger sync when back online
  const unsubscribe = NetInfo.addEventListener(state => {
    const online = state.isConnected ?? false;
    set({isOnline: online});
    if (online) {
      get().syncQueue?.();
    }
  });

  // 3) Return slice props
  return {
    isOnline: true, // optimistic default until fetch resolves
  };
};
