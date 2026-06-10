import { useAppStore, useIsOnline } from '#store/useAppStore';

/**
 * Whether the persistent offline banner is currently shown.
 *
 * Shared by `OfflineBanner` (which renders the bar) and
 * `OfflineBannerInsetProvider` (which re-publishes the safe-area insets with
 * `top: 0` below the banner, since the banner then supplies the status-bar
 * inset). Keeping both readers on one hook stops the inset math from drifting.
 */
export const useIsOfflineBannerVisible = (): boolean => {
  const isOnline = useIsOnline();
  const offlineModeEnabled = useAppStore(state => state.offlineModeEnabled);
  return !isOnline || offlineModeEnabled;
};
