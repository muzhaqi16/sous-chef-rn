import { StateCreator } from 'zustand';
import { RootState } from '../index';
import { storage } from '#/storage/mmkv';

const OFFLINE_MODE_KEY = 'user_offline_mode';

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

  // Actions
  setNetworkStatus: (status: {
    isOnline: boolean;
    isInternetReachable: boolean | null;
    networkType: string | null;
  }) => void;
  setOnline: () => void;
  setOffline: () => void;
  setNeedsTokenRefresh: (value: boolean) => void;
  setOfflineModeEnabled: (enabled: boolean) => void;
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

const initialNetworkState = {
  isOnline: true, // Assume online until proven otherwise (per Apollo best practices)
  isInternetReachable: null,
  networkType: null,
  lastOnlineTime: null,
  lastOfflineTime: null,
  needsTokenRefresh: false,
  offlineModeEnabled: false,
  apiReachable: true,
};

export const createNetworkSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  NetworkState
> = (set, get) => ({
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
  },

  setOnline: () => {
    const state = get();
    if (!state.isOnline) {
      set(draft => {
        draft.isOnline = true;
        draft.lastOnlineTime = Date.now();
      });
    }
  },

  setOffline: () => {
    const state = get();
    if (state.isOnline) {
      set(draft => {
        draft.isOnline = false;
        draft.lastOfflineTime = Date.now();
      });
    }
  },

  setNeedsTokenRefresh: (value: boolean) => {
    set(draft => {
      draft.needsTokenRefresh = value;
    });
  },

  setOfflineModeEnabled: (enabled: boolean) => {
    set(draft => {
      draft.offlineModeEnabled = enabled;
    });
    storage.set(OFFLINE_MODE_KEY, enabled);
  },

  setApiReachable: (reachable: boolean) => {
    if (get().apiReachable === reachable) return;
    set(draft => {
      draft.apiReachable = reachable;
    });
  },
});

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
