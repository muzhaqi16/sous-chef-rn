import { StateCreator } from 'zustand';
import type { RootState } from '../index';
import { storage } from '#/storage/mmkv';

const OFFLINE_MODE_KEY = 'user_offline_mode';

/**
 * Why the banner is showing; `null` means it isn't. A cause rather than a
 * boolean: during the minimum-visible window the flags may already have
 * recovered, so re-deriving would swap the text mid-display.
 */
export type OfflineBannerCause =
  | 'device-offline'
  | 'api-unreachable'
  | 'offline-mode';

/**
 * How long each cause must hold before the user sees anything. Only the
 * ANNOUNCEMENT waits — the offline policy (`isApiUnavailable`) is instant.
 * Dwell is per-cause by trustworthiness; `api-unreachable` is inferred from
 * failed requests, so it needs the most corroboration.
 */
const SHOW_DWELL_MS: Record<OfflineBannerCause, number> = {
  'offline-mode': 0,
  'device-offline': 2_000,
  'api-unreachable': 5_000,
};

/**
 * Minimum time on screen; without it an outage resolving just after the dwell
 * flashes the banner and the "back online" toast back to back.
 */
const MIN_VISIBLE_MS = 3_000;

export interface NetworkState {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  networkType: string | null;
  lastOnlineTime: number | null;
  lastOfflineTime: number | null;
  needsTokenRefresh: boolean;
  /** User-enabled offline mode (from app settings) */
  offlineModeEnabled: boolean;
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

  setNetworkStatus: (status: {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    networkType: string | null;
  }) => void;
  setOnline: () => void;
  setOffline: () => void;
  setNeedsTokenRefresh: (value: boolean) => void;
  /**
   * `immediate` skips the banner's dwell/hold — pass it only from a control the
   * user just operated; boot hydration and settings sync take the debounced path.
   */
  setOfflineModeEnabled: (enabled: boolean, immediate?: boolean) => void;
  setApiReachable: (reachable: boolean | null) => void;
}

/**
 * The server cannot be reached: serve queries from cache, queue mutations.
 * Shared by `offlineModeLink`, `queueLink` and the queue manager.
 */
export const isApiUnavailable = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable'>,
): boolean => state.apiReachable === false || shouldTreatAsOffline(state);

/**
 * NetInfo reports no internet and nothing has PROVEN the API reachable anyway.
 * First-hand `apiReachable` may veto generic-endpoint `isOnline`, but only as
 * proof — hence tri-state, `null` meaning untried since the link dropped. An
 * ASSUMED `true` surviving offline is a one-way door: no traffic, no breaker.
 */
export const shouldTreatAsOffline = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable'>,
): boolean => !state.isOnline && state.apiReachable !== true;

/**
 * Whether a cache-missing query is answered with an offline error rather than
 * reaching the network. Deliberately NARROWER than `isApiUnavailable`: with only
 * the breaker open, `offlineModeLink` still forwards a miss as an organic probe,
 * so a failure there is a real network error, not "we never tried".
 */
export const blocksCacheMissQueries = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable' | 'offlineModeEnabled'>,
): boolean => state.offlineModeEnabled || shouldTreatAsOffline(state);

/**
 * The undebounced reason to tell the user we are offline. Losing the device
 * connection explains everything else, so it outranks an unreachable API, which
 * outranks the user's own offline-mode switch.
 */
const resolveOfflineCause = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable' | 'offlineModeEnabled'>,
): OfflineBannerCause | null => {
  if (shouldTreatAsOffline(state)) return 'device-offline';
  if (state.apiReachable === false) return 'api-unreachable';
  if (state.offlineModeEnabled) return 'offline-mode';
  return null;
};

const initialNetworkState = {
  isOnline: true, // Assume online until proven otherwise.
  isInternetReachable: null,
  networkType: null,
  lastOnlineTime: null,
  lastOfflineTime: null,
  needsTokenRefresh: false,
  offlineModeEnabled: false,
  apiReachable: true,
  offlineBannerCause: null,
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
   * screen. `immediate` skips both the dwell and the hold — a switch the user
   * just flipped is not flapping, and holding it announces a state they left.
   */
  const syncOfflineBanner = (immediate = false): void => {
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

    const delay = immediate
      ? 0
      : cause !== null
      ? SHOW_DWELL_MS[cause]
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

    setOfflineModeEnabled: (enabled: boolean, immediate = false) => {
      set(draft => {
        draft.offlineModeEnabled = enabled;
      });
      storage.set(OFFLINE_MODE_KEY, enabled);
      syncOfflineBanner(immediate);
    },

    setApiReachable: (reachable: boolean | null) => {
      if (get().apiReachable === reachable) return;
      set(draft => {
        draft.apiReachable = reachable;
      });
      syncOfflineBanner();
    },
  };
};

/**
 * Out of the slice's initial state because the `storage` Proxy throws before
 * `initializeSecureStorage()`, and the slice is built at module load. The
 * persist `onRehydrateStorage` callback runs after init, so the read is safe.
 */
export const hydrateOfflineModeFromStorage = (
  setOfflineModeEnabled: (enabled: boolean) => void,
) => {
  const stored = storage.getBoolean(OFFLINE_MODE_KEY);
  if (stored !== undefined) {
    setOfflineModeEnabled(stored);
  }
};
