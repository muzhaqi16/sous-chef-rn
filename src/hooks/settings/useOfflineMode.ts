import { useAppStore, useIsOnline } from '#store/useAppStore';

/**
 * Reads the store (synced from MMKV on hydration, then from `useAppSettings`),
 * so no `GetUserSettings` query fires.
 */
function useOfflineModePreference(): boolean {
  return useAppStore(state => state.offlineModeEnabled);
}

export const useIsEffectivelyOffline = (): boolean => {
  const isOnline = useIsOnline();
  const isOfflineModeEnabled = useOfflineModePreference();
  return isOfflineModeEnabled || !isOnline;
};
