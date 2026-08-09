import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { storage } from '#/storage/mmkv';

const OFFLINE_MODE_KEY = 'user_offline_mode';

/**
 * Why the banner is showing. `null` means it isn't. Kept as a cause rather than
 * a boolean so the icon/message can't disagree with the reason we decided to
 * show it — during the minimum-visible window the underlying flags may already
 * have recovered, and re-deriving the cause from them would swap the text
 * mid-display.
 */
export type OfflineBannerCause =
  | 'device-offline'
  | 'api-unreachable'
  | 'offline-mode';

/**
 * How long each cause must hold continuously before the user sees anything.
 *
 * The offline *policy* (serve cache, queue mutations) reacts instantly — see
 * `isApiUnavailable`. Only the announcement waits, because a banner that
 * appears on a single failed request and vanishes on the next success reads as
 * a flicker, not as information. Dwell is per-cause because the causes differ
 * in trustworthiness:
 *  - `offline-mode` is a switch the user just flipped — confirm nothing.
 *  - `device-offline` is an OS-level signal (airplane mode, radio off); short
 *    dwell only to absorb NetInfo's reachability probe blipping.
 *  - `api-unreachable` is *inferred* from failed requests, so it's the
 *    flappiest input and needs the most corroboration.
 */
const SHOW_DWELL_MS: Record<OfflineBannerCause, number> = {
  'offline-mode': 0,
  'device-offline': 2_000,
  'api-unreachable': 5_000,
};

/**
 * Once shown, the banner stays up at least this long. Without it, an outage
 * that resolves a moment after the dwell elapsed would flash the banner and the
 * "back online" toast back to back.
 */
const MIN_VISIBLE_MS = 3_000;

export interface NetworkState {
  // Network status
  isOnline: boolean;
  isInternetReachable: boolean | null;
  networkType: string | null;
  lastOnlineTime: number | null;
  lastOfflineTime: number | null;
  needsTokenRefresh: boolean;
  /** User-enabled offline mode (from app settings) */
  offlineModeEnabled: boolean;
  /**
   * Whether our GraphQL API is currently reachable. Distinct from `isOnline`
   * (device internet): the device can be online while the API is down /
   * timing out / behind a captive portal. Driven by `apiReachabilityBreaker`
   * (a circuit breaker over network outcomes), NOT by NetInfo.
   */
  apiReachable: boolean;
  /**
   * Debounced, presentation-only view of the offline state — the single input
   * to `OfflineStatusPill` / `OfflineTransitionToaster` (via
   * `useIsOfflineBannerVisible` / `useOfflineStatus`). Lives in the store, not
   * in a hook, so every mounted pill agrees and so navigating between screens
   * doesn't restart the dwell timer on a fresh mount.
   *
   * Never read this for offline *behaviour* — use `isApiUnavailable`, which is
   * instant.
   */
  offlineBannerCause: OfflineBannerCause | null;

  // Actions
  setNetworkStatus: (status: {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    networkType: string | null;
  }) => void;
  setOnline: () => void;
  setOffline: () => void;
  setNeedsTokenRefresh: (value: boolean) => void;
  /**
   * `immediate` skips the banner's dwell/hold debouncing — pass it only from a
   * control the user just operated. The other callers (MMKV hydration on boot,
   * the `GetUserSettings` sync in `useAppSettings`) are not user gestures and
   * take the debounced path.
   */
  setOfflineModeEnabled: (enabled: boolean, immediate?: boolean) => void;
  setApiReachable: (reachable: boolean) => void;
}

/**
 * The server can't be reached right now — either the device is offline or our
 * API is unreachable (circuit breaker tripped). Both cases should behave the
 * same: serve queries from cache, queue mutations. Shared by `offlineModeLink`,
 * `queueLink`, and the queue manager so the policy stays consistent.
 */
export const isApiUnavailable = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable'>,
): boolean => !state.isOnline || state.apiReachable === false;

/**
 * Whether a query that misses the cache is answered with an offline error
 * instead of reaching the network.
 *
 * Deliberately narrower than `isApiUnavailable`: when only the reachability
 * breaker is open, `offlineModeLink` still forwards a cache miss as an organic
 * probe, so a failure there is a real network error and must be reported as
 * one. Screens use this to tell "we never tried" apart from "we tried and it
 * failed" — `offlineModeLink` reads the same selector so the two cannot drift.
 */
export const blocksCacheMissQueries = (
  state: Pick<NetworkState, 'isOnline' | 'offlineModeEnabled'>,
): boolean => !state.isOnline || state.offlineModeEnabled;

/**
 * The reason the user should be told we're offline, at this instant and with no
 * debouncing. Priority: losing the device's connection explains everything else,
 * so it outranks an unreachable API, which in turn outranks the user's own
 * offline-mode switch.
 */
const resolveOfflineCause = (
  state: Pick<NetworkState, 'isOnline' | 'apiReachable' | 'offlineModeEnabled'>,
): OfflineBannerCause | null => {
  if (!state.isOnline) return 'device-offline';
  if (state.apiReachable === false) return 'api-unreachable';
  if (state.offlineModeEnabled) return 'offline-mode';
  return null;
};

const initialNetworkState = {
  isOnline: true, // Assume online until proven otherwise (per Apollo best practices)
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
   * Re-evaluate the banner after any connectivity input changes. Called by every
   * setter below; a pending transition is always cancelled first, so flapping
   * that settles inside the dwell window never reaches the screen at all.
   *
   * `immediate` skips both the show dwell and the minimum-visible hold. Those
   * exist to absorb *flapping* — a radio blipping, a request failing once. A
   * switch the user just flipped isn't flapping, and holding its announcement
   * for the rest of MIN_VISIBLE_MS meant toggling off right after on surfaced
   * the second toast seconds late, describing a state the user had already left.
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

        // Track transition timestamps
        if (!wasOnline && status.isOnline) {
          state.lastOnlineTime = Date.now();
        } else if (wasOnline && !status.isOnline) {
          state.lastOfflineTime = Date.now();
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
      // Only a switch the user just flipped skips the debounce — see the
      // interface note. Boot hydration and the settings sync go through the
      // normal dwell/hold so a value arriving from elsewhere can't yank the
      // banner off screen mid-hold.
      syncOfflineBanner(immediate);
    },

    setApiReachable: (reachable: boolean) => {
      if (get().apiReachable === reachable) return;
      set(draft => {
        draft.apiReachable = reachable;
      });
      syncOfflineBanner();
    },
  };
};

/**
 * Hydrate `offlineModeEnabled` from MMKV. Called from the persist
 * `onRehydrateStorage` callback, which only fires after
 * `initializeSecureStorage()` has resolved — making sync MMKV reads safe.
 *
 * Kept out of the slice's initial state because the `storage` Proxy throws
 * if accessed before init, and the slice is constructed at module-load time
 * (before `index.js` runs `initializeSecureStorage()`).
 */
export const hydrateOfflineModeFromStorage = (
  setOfflineModeEnabled: (enabled: boolean) => void,
) => {
  const stored = storage.getBoolean(OFFLINE_MODE_KEY);
  if (stored !== undefined) {
    setOfflineModeEnabled(stored);
  }
};
