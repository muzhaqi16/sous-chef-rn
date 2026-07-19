import { useAppStore } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';

/**
 * Whether the server can't currently be reached — drives the persistent
 * offline indicator (`OfflineStatusPill`) and transition toaster
 * (`OfflineTransitionToaster`) via `useOfflineStatus`.
 *
 * Reuses the shared `isApiUnavailable` selector (device offline OR the API
 * reachability breaker being open) and adds the user-toggled offline mode, so
 * the banner condition stays in step with the rest of the offline policy.
 */
export const useIsOfflineBannerVisible = (): boolean =>
  useAppStore(state => isApiUnavailable(state) || state.offlineModeEnabled);
