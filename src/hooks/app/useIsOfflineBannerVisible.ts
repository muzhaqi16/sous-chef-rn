import { useAppStore, useIsOnline } from '#store/useAppStore';

/**
 * Whether the server can't currently be reached — drives the persistent
 * offline indicator (`OfflineStatusPill`) and transition toaster
 * (`OfflineTransitionToaster`) via `useOfflineStatus`.
 *
 * Covers all three "offline" cases so callers don't have to reassemble them:
 * device offline, API breaker open while the device is online, and
 * user-toggled offline mode.
 */
export const useIsOfflineBannerVisible = (): boolean => {
  const isOnline = useIsOnline();
  const apiReachable = useAppStore(state => state.apiReachable);
  const offlineModeEnabled = useAppStore(state => state.offlineModeEnabled);
  // Covers both "can't reach the server" cases — device offline AND API down
  // while the device is online (reachability breaker open) — plus the
  // user-toggled offline mode.
  return !isOnline || apiReachable === false || offlineModeEnabled;
};
