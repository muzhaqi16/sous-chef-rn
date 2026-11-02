import type { StateCreator } from 'zustand';
import type { RootState } from '../index';

/**
 * Why the banner is showing; `null` means it isn't. A cause rather than a
 * boolean: during the minimum-visible window the flags may already have
 * recovered, so re-deriving would swap the text mid-display.
 */
export type OfflineBannerCause = 'device-offline' | 'api-unreachable';

/**
 * How long a cause must hold before the user sees anything, so a passing hiccup
 * never shows the icon. Only the PRESENTATION waits: the offline policy
 * (`isApiUnavailable`) is instant.
 */
const SHOW_DWELL_MS = 30_000;

/**
 * Minimum time on screen; without it an outage resolving just after the dwell
 * flashes the icon in and out.
 */
const MIN_VISIBLE_MS = 3_000;

export interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  networkType: string | null;
  lastOnlineTime: number | null;
  lastOfflineTime: number | null;
  needsTokenRefresh: boolean;
  /**
   * Whether the GraphQL API is reachable — distinct from `isOnline` (device
   * internet). Driven by `apiReachabilityBreaker`, NOT by NetInfo.
   */
  apiReachable: boolean | null;
  /**
   * Debounced, PRESENTATION-only view of the offline state. In the store rather
   * than a hook so every mounted pill agrees and navigation doesn't restart the
   * dwell timer. Never read it for behaviour — use `isApiUnavailable`.
   */
  offlineBannerCause: OfflineBannerCause | null;
  /**
   * The server refused this build as below its minimum version. Never
   * persisted, so an updated build starts clear; a response the server's
   * version gate admits clears it, so a floor rolled back stops blocking.
   */
  clientUpgradeRequired: boolean;

  setNetworkStatus: (status: {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    networkType: string | null;
  }) => void;
  setOnline: () => void;
  setOffline: () => void;
  setNeedsTokenRefresh: (value: boolean) => void;
  setApiReachable: (reachable: boolean | null) => void;
  markClientUpgradeRequired: () => void;
  clearClientUpgradeRequired: () => void;
}

/**
 * The app's one answer to "are we offline?": no connection, or the API proven
 * down. Queries are served from the cache and mutations queue. Features read it
 * through `useIsApiUnavailable`; raw `isOnline` belongs to transport.
 */
export const isApiUnavailable = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable'>,
): boolean => state.apiReachable === false || shouldTreatAsOffline(state);

/**
 * NetInfo reports no internet and nothing has PROVEN the API reachable anyway.
 * First-hand `apiReachable` may veto generic-endpoint `isOnline`, but only as
 * proof — hence tri-state, `null` meaning untried since the link dropped. An
 * ASSUMED `true` surviving offline is a one-way door: no traffic, no breaker.
 * Narrower than `isApiUnavailable`: with only the breaker open, `offlineReadLink`
 * still forwards a cache miss as an organic probe.
 */
export const shouldTreatAsOffline = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable'>,
): boolean => !state.isOnline && state.apiReachable !== true;

/**
 * The undebounced reason to tell the user we are offline. Losing the device
 * connection explains everything else, so it outranks an unreachable API.
 */
const resolveOfflineCause = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable'>,
): OfflineBannerCause | null => {
  if (shouldTreatAsOffline(state)) return 'device-offline';
  if (state.apiReachable === false) return 'api-unreachable';
  return null;
};

const initialNetworkState = {
  isOnline: true, // Assume online until proven otherwise: try, then learn.
  isInternetReachable: null,
  networkType: null,
  lastOnlineTime: null,
  lastOfflineTime: null,
  needsTokenRefresh: false,
  // UNKNOWN, not reachable. `shouldTreatAsOffline` lets a first-hand `true`
  // veto NetInfo's `isOnline: false`, so an assumed `true` here outranks the
  // platform saying there is no link — on a cold start with no network the app
  // reported itself online until the breaker had failed three requests.
  apiReachable: null,
  offlineBannerCause: null,
  clientUpgradeRequired: false,
};

export const createNetworkSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  NetworkState
> = (set, get) => {
  let bannerTimer: ReturnType<typeof setTimeout> | null = null;
  let bannerShownAt = 0;

  const applyBannerCause = (cause: OfflineBannerCause | null): void => {
    if (get().offlineBannerCause === cause) return;
    if (cause !== null && get().offlineBannerCause === null) {
      bannerShownAt = Date.now();
    }
    set(draft => {
      draft.offlineBannerCause = cause;
    });
  };

  /**
   * Re-evaluate the banner. Every setter calls it and a pending transition is
   * cancelled first, so flapping that settles inside the dwell never reaches the
   * screen.
   */
  const syncOfflineBanner = (): void => {
    if (bannerTimer) {
      clearTimeout(bannerTimer);
      bannerTimer = null;
    }
    const cause = resolveOfflineCause(get());
    const shown = get().offlineBannerCause;
    if (cause === shown) return;

    // Already visible and still offline: swapping the reason is a label change,
    // not an appearance, so there's nothing to debounce.
    if (cause !== null && shown !== null) {
      applyBannerCause(cause);
      return;
    }

    const delay =
      cause !== null
        ? SHOW_DWELL_MS
        : Math.max(0, MIN_VISIBLE_MS - (Date.now() - bannerShownAt));
    if (delay === 0) {
      applyBannerCause(cause);
      return;
    }
    bannerTimer = setTimeout(() => {
      bannerTimer = null;
      applyBannerCause(cause);
    }, delay);
  };

  return {
    ...initialNetworkState,

    setNetworkStatus: status => {
      set(state => {
        const wasOnline = state.isOnline;
        state.isOnline = status.isOnline;
        state.isInternetReachable = status.isInternetReachable;
        state.networkType = status.networkType;

        if (!wasOnline && status.isOnline) {
          state.lastOnlineTime = Date.now();
        } else if (wasOnline && !status.isOnline) {
          state.lastOfflineTime = Date.now();
          // Losing the link invalidates what we knew about the API — only
          // PROOF may override NetInfo. Owned here, not by the breaker, so the
          // invariant holds however the device goes offline.
          state.apiReachable = null;
        }
      });
      syncOfflineBanner();
    },

    setOnline: () => {
      const state = get();
      if (!state.isOnline) {
        set(draft => {
          draft.isOnline = true;
          draft.lastOnlineTime = Date.now();
        });
        syncOfflineBanner();
      }
    },

    setOffline: () => {
      const state = get();
      if (state.isOnline) {
        set(draft => {
          draft.isOnline = false;
          draft.lastOfflineTime = Date.now();
          // See `setNetworkStatus`: what we knew about the API expires with the
          // link, so it goes back to unknown until a probe settles it.
          draft.apiReachable = null;
        });
        syncOfflineBanner();
      }
    },

    setNeedsTokenRefresh: (value: boolean) => {
      set(draft => {
        draft.needsTokenRefresh = value;
      });
    },

    setApiReachable: (reachable: boolean | null) => {
      if (get().apiReachable === reachable) return;
      set(draft => {
        draft.apiReachable = reachable;
      });
      syncOfflineBanner();
    },

    markClientUpgradeRequired: () => {
      if (get().clientUpgradeRequired) return;
      set(draft => {
        draft.clientUpgradeRequired = true;
      });
    },

    clearClientUpgradeRequired: () => {
      if (!get().clientUpgradeRequired) return;
      set(draft => {
        draft.clientUpgradeRequired = false;
      });
    },
  };
};
