import { useEffect } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAppStore } from '#store/useAppStore';

/**
 * Subscribe to NetInfo and sync connectivity state into the app store.
 *
 * `isInternetReachable` is `null` when NetInfo hasn't probed yet — we treat
 * that as online (matching the original semantics) so the UI doesn't flash
 * an offline state on cold start.
 */
export function useNetworkStatus() {
  const setNetworkStatus = useAppStore(state => state.setNetworkStatus);
  const netInfo = useNetInfo();

  useEffect(() => {
    if (netInfo.isConnected == null) return; // initial indeterminate emission

    const isOnline =
      netInfo.isConnected === true && netInfo.isInternetReachable !== false;

    setNetworkStatus({
      isOnline,
      isInternetReachable: netInfo.isInternetReachable,
      networkType: netInfo.type,
    });
  }, [
    netInfo.isConnected,
    netInfo.isInternetReachable,
    netInfo.type,
    setNetworkStatus,
  ]);
}
