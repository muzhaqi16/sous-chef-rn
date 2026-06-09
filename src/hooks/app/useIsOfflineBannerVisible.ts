import { useAppStore, useIsOnline } from '#store/useAppStore';

/**
 * Whether the persistent offline banner is currently shown.
 *
 * Shared by `OfflineBanner` (which renders the bar) and the navigation
 * `TopInsetLayout` (which skips its own top inset while the banner is up,
 * because the banner then supplies the status-bar inset for the screen below
 * it). Keeping both readers on one hook stops the inset math from drifting.
 */
export const useIsOfflineBannerVisible = (): boolean => {
  const isOnline = useIsOnline();
  const offlineModeEnabled = useAppStore(state => state.offlineModeEnabled);
  return !isOnline || offlineModeEnabled;
};
