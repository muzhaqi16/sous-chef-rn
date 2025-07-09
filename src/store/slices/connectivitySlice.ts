import NetInfo, {NetInfoState} from '@react-native-community/netinfo';
import {StateCreator} from 'zustand';
import {RootState} from '../index';

export interface ConnectivityState {
  /** Are we currently online? */
  isOnline: boolean;
  /**
   * If set, called whenever we transition back _online_.
   * You can use this to flush any queued mutations.
   */
  syncQueue?: () => Promise<void>;
  /** Register your queue‐flush function here */
  setSyncQueue: (callback: () => Promise<void>) => void;
}

export const createConnectivitySlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  ConnectivityState
> = (set, get) => {
  // 1) Grab the initial state
  NetInfo.fetch().then((state: NetInfoState) => {
    set(s => {
      s.isOnline = state.isConnected ?? false;
    });
  });

  // 2) Listen for changes
  const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
    const online = state.isConnected ?? false;
    set(s => {
      s.isOnline = online;
    });

    // if we just came back online, run the syncQueue
    if (online && get().syncQueue) {
      get().syncQueue!();
    }
  });

  // (Optional) you could store unsubscribe in state or call it on unmount,
  // but for a global slice it’s usually fine to leave the listener active.

  // 3) Return the slice’s initial state + actions
  return {
    isOnline: true,
    syncQueue: undefined,
    setSyncQueue: callback =>
      set(state => {
        state.syncQueue = callback;
      }),
  };
};
