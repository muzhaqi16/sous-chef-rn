import { useEffect } from 'react';
import { requirePlatform } from '#platform/install';
import { useAppStore } from '#store/useAppStore';

/**
 * Feeds the host's connectivity into the store. A `null` `isInternetReachable`
 * (not probed yet) counts as online, so the UI doesn't flash offline on cold
 * start; the report before the first real one (`isConnected: null`) is skipped.
 */
export function useNetworkStatusSync(): void {
  const setNetworkStatus = useAppStore(state => state.setNetworkStatus);

  useEffect(() => {
    // The store hears a change, not every report that repeats the last.
    let last: string | undefined;
    return requirePlatform('connectivity').subscribe(state => {
      if (state.isConnected === null) return;
      const isOnline = state.isConnected && state.isInternetReachable !== false;
      const key = `${isOnline}|${state.isInternetReachable}|${state.type}`;
      if (key === last) return;
      last = key;
      setNetworkStatus({
        isOnline,
        isInternetReachable: state.isInternetReachable,
        networkType: state.type,
      });
    });
  }, [setNetworkStatus]);
}
