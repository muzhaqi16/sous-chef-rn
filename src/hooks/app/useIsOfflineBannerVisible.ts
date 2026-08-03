import { useAppStore } from '#store/useAppStore';

/**
 * Whether to tell the user the server can't be reached — drives the persistent
 * offline indicator (`OfflineStatusPill`) and transition toaster
 * (`OfflineTransitionToaster`) via `useOfflineStatus`.
 *
 * Reads the debounced `offlineBannerCause` rather than the raw flags: the
 * offline *policy* flips the instant a request fails (`isApiUnavailable`), which
 * is right for serving cache and queueing mutations but far too twitchy to show
 * a human — a single failed request followed by a single success would flash the
 * banner on and off. The dwell/minimum-visible rules live in `networkSlice`.
 */
export const useIsOfflineBannerVisible = (): boolean =>
  useAppStore(state => state.offlineBannerCause !== null);
