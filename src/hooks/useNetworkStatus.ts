import { useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useAppStore } from '#store/useAppStore';

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
  const setNetworkStatus = useAppStore(state => state.setNetworkStatus);

  useEffect(
    () => {
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
    },
    [],
  );
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

