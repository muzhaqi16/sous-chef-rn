import { useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useStore } from '#store';

/**
 * Hook to monitor network status and sync with store
 *
 * This hook sets up a NetInfo listener that automatically updates
 * the global network state in the Zustand store.
 *
 * Usage:
 * ```typescript
 * // In your root App.tsx or layout component
 * useNetworkStatus();
 *
 * // In any component
 * const { isOnline } = useStore(state => ({ isOnline: state.isOnline }));
 * ```
 */
export function useNetworkStatus() {
  const setNetworkStatus = useStore(state => state.setNetworkStatus);

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(state => {
      updateNetworkState(state, setNetworkStatus);
    });

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      updateNetworkState(state, setNetworkStatus);
    });

    return () => {
      unsubscribe();
    };
  }, [setNetworkStatus]);
}

/**
 * Helper function to update network state in store
 */
function updateNetworkState(
  state: NetInfoState,
  setNetworkStatus: (status: {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    networkType: string | null;
  }) => void
) {
  const isOnline = state.isConnected === true && state.isInternetReachable !== false;

  setNetworkStatus({
    isOnline,
    isInternetReachable: state.isInternetReachable,
    networkType: state.type,
  });
}

/**
 * Selector hook to get network status from store
 *
 * Usage:
 * ```typescript
 * const { isOnline, isOffline, networkType } = useNetworkState();
 * ```
 */
export function useNetworkState() {
  return useStore(state => ({
    isOnline: state.isOnline,
    isOffline: !state.isOnline,
    isInternetReachable: state.isInternetReachable,
    networkType: state.networkType,
    lastOnlineTime: state.lastOnlineTime,
    lastOfflineTime: state.lastOfflineTime,
  }));
}
