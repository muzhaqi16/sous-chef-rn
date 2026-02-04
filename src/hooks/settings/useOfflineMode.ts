import { useMemo } from 'react';
import { useStore } from '#store';
import { useAppSettings } from '#hooks/profile/useAppSettings';

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
  const isOnline = useStore(state => state.isOnline);

  // User's offline mode preference from server settings
  const { settings, loading } = useAppSettings();
  const isOfflineModeEnabled = settings.offlineMode;

  // Computed states
  const isDeviceOffline = !isOnline;
  const isEffectivelyOffline = isOfflineModeEnabled || isDeviceOffline;
  const canUseNetwork = isOnline && !isOfflineModeEnabled;

  return useMemo(() => ({
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
     * Loading state from server settings
     */
    loading,
  }), [isEffectivelyOffline, isDeviceOffline, isOfflineModeEnabled, canUseNetwork, loading]);
};

/**
 * Selector hook that returns true if app is effectively offline
 * Use this for simple checks without needing all the details
 */
export const useIsEffectivelyOffline = (): boolean => {
  const isOnline = useStore(state => state.isOnline);
  const { settings } = useAppSettings();
  return settings.offlineMode || !isOnline;
};

/**
 * Selector hook that returns true if network operations are allowed
 */
export const useCanUseNetwork = (): boolean => {
  const isOnline = useStore(state => state.isOnline);
  const { settings } = useAppSettings();
  return isOnline && !settings.offlineMode;
};
