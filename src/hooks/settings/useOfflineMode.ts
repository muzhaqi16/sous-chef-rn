import { useAppStore, useIsOnline } from '#store/useAppStore';

/**
 * Read offlineMode from Zustand (synced from MMKV on hydration and from
 * useAppSettings on GraphQL response).
 *
 * PERFORMANCE: Avoids calling useAppSettings() which triggers the GetUserSettings
 * GraphQL query. Reactive — updates immediately when the user toggles offline mode.
 */
function useOfflineModePreference(): boolean {
  return useAppStore(state => state.offlineModeEnabled);
}

/**
 * Offline mode state and feature gating
 *
 * Provides:
 * - `isEffectivelyOffline`: True if user enabled offline mode OR device is offline
 * - `isDeviceOffline`: True if device has no network connectivity
 * - `isOfflineModeEnabled`: True if user explicitly enabled offline mode in settings
 * - `canUseNetwork`: True if both device is online and offline mode is disabled
 *
 * @example
 * ```tsx
 * const { isEffectivelyOffline, canUseNetwork } = useOfflineMode();
 *
 * if (!canUseNetwork) {
 *   // Disable search, sharing, external API calls
 *   return <OfflineMessage />;
 * }
 * ```
 */
export const useOfflineMode = () => {
  // Device network state from Zustand
  const isOnline = useIsOnline();

  // User's offline mode preference from MMKV (no GraphQL query)
  const isOfflineModeEnabled = useOfflineModePreference();

  // Computed states
  const isDeviceOffline = !isOnline;
  const isEffectivelyOffline = isOfflineModeEnabled || isDeviceOffline;
  const canUseNetwork = isOnline && !isOfflineModeEnabled;

  return {
    /**
     * True if app should behave as offline (user enabled OR device offline)
     * Use this to switch fetch policies to cache-only
     */
    isEffectivelyOffline,

    /**
     * True if device has no network connectivity
     */
    isDeviceOffline,

    /**
     * True if user explicitly enabled offline mode in settings
     */
    isOfflineModeEnabled,

    /**
     * True if network operations are allowed
     * (device is online AND user hasn't enabled offline mode)
     */
    canUseNetwork,

    /**
     * Loading state - always false since we read from MMKV
     */
    loading: false,
  };
};

/**
 * Selector hook that returns true if app is effectively offline
 * Use this for simple checks without needing all the details
 */
export const useIsEffectivelyOffline = (): boolean => {
  const isOnline = useIsOnline();
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOfflineModeEnabled || !isOnline;
};

/**
 * Selector hook that returns true if network operations are allowed
 */
export const useCanUseNetwork = (): boolean => {
  const isOnline = useIsOnline();
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOnline && !isOfflineModeEnabled;
};
