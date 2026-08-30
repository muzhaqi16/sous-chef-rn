import { useAppStore, useIsOnline } from '#store/useAppStore';

/**
 * Reads the store (synced from MMKV on hydration, then from `useAppSettings`),
 * so no `GetUserSettings` query fires.
 */
function useOfflineModePreference(): boolean {
  return useAppStore(state => state.offlineModeEnabled);
}

/** Offline-mode state and feature gating. */
export const useOfflineMode = () => {
  const isOnline = useIsOnline();
  const isOfflineModeEnabled = useOfflineModePreference();

  const isDeviceOffline = !isOnline;
  const isEffectivelyOffline = isOfflineModeEnabled || isDeviceOffline;
  const canUseNetwork = isOnline && !isOfflineModeEnabled;

  return {
    /** User enabled offline mode OR the device is offline — switch to cache-only. */
    isEffectivelyOffline,
    isDeviceOffline,
    isOfflineModeEnabled,
    /** Device online AND offline mode off. */
    canUseNetwork,
    /** Always false — this reads MMKV, not the network. */
    loading: false,
  };
};

export const useIsEffectivelyOffline = (): boolean => {
  const isOnline = useIsOnline();
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOfflineModeEnabled || !isOnline;
};

export const useCanUseNetwork = (): boolean => {
  const isOnline = useIsOnline();
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOnline && !isOfflineModeEnabled;
};
