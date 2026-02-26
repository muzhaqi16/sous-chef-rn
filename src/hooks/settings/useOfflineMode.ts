import { useState } from 'react';
import { useAppStore } from '#store/useAppStore';
import { storage } from '#/storage/mmkv';

/**
 * Read offlineMode from MMKV (synced by useAppSettings).
 * Defaults to false — offline mode is rarely enabled.
 *
 * PERFORMANCE: Avoids calling useAppSettings() which triggers the GetUserSettings
 * GraphQL query. This hook is called from multiple startup-path components
 * (e.g., usePantryItemSuggestions, offlineFetchPolicies) and was causing
 * GetUserSettings to fire at startup competing with critical queries.
 */
function useOfflineModePreference(): boolean {
  const [value] = useState(() => storage.getBoolean('user_offline_mode') ?? false);
  return value;
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
  const isOnline = useAppStore(state => state.isOnline);

  // User's offline mode preference from MMKV (no GraphQL query)
  const isOfflineModeEnabled = useOfflineModePreference();

  // Computed states
  const isDeviceOffline = !isOnline;
  const isEffectivelyOffline = isOfflineModeEnabled || isDeviceOffline;
  const canUseNetwork = isOnline && !isOfflineModeEnabled;

  return ({
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
  });
};

/**
 * Selector hook that returns true if app is effectively offline
 * Use this for simple checks without needing all the details
 */
export const useIsEffectivelyOffline = (): boolean => {
  const isOnline = useAppStore(state => state.isOnline);
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOfflineModeEnabled || !isOnline;
};

/**
 * Selector hook that returns true if network operations are allowed
 */
export const useCanUseNetwork = (): boolean => {
  const isOnline = useAppStore(state => state.isOnline);
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOnline && !isOfflineModeEnabled;
};
