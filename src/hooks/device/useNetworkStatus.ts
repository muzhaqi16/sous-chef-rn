import { useEffect } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { useAppStore } from '#store/useAppStore';

/**
 * Syncs NetInfo into the app store. A `null` `isInternetReachable` (not probed
 * yet) counts as online, so the UI doesn't flash offline on cold start.
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
