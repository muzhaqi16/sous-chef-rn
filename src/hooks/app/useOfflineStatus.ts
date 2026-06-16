import { useTranslation } from 'react-i18next';
import type { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppStore, useIsOnline } from '#store/useAppStore';
import { useIsOfflineBannerVisible } from '#hooks/app/useIsOfflineBannerVisible';
import { usePendingMutationCount } from '#/hooks/offline/usePendingMutationCount';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface OfflineStatus {
  /** Whether the server can't currently be reached. */
  offline: boolean;
  /** Icon representing the current offline cause. */
  iconName: IoniconName;
  /** User-facing message for the current offline cause + pending count. */
  message: string;
  /** Count of mutations queued locally, waiting to sync. */
  pendingCount: number;
}

/**
 * Resolves the current offline cause into the icon + message shown by the
 * offline indicator (`OfflineStatusPill`) and announced by the transition
 * toaster (`OfflineTransitionToaster`). Keeping both readers on one hook stops
 * the icon/message logic from drifting between them.
 */
export const useOfflineStatus = (): OfflineStatus => {
  const { t } = useTranslation();
  const isOnline = useIsOnline();
  const apiReachable = useAppStore(state => state.apiReachable);
  const pendingCount = usePendingMutationCount();
  const offline = useIsOfflineBannerVisible();

  // Priority: device offline > API unreachable while online (reachability
  // breaker open) > user-toggled offline mode.
  const isDeviceOffline = !isOnline;
  const isApiDown = isOnline && apiReachable === false;
  const iconName: IoniconName =
    isDeviceOffline || isApiDown ? 'cloud-offline-outline' : 'airplane-outline';

  const message = isDeviceOffline
    ? pendingCount > 0
      ? t('offlineBanner.deviceOfflinePending', { count: pendingCount })
      : t('offlineBanner.deviceOffline')
    : isApiDown
    ? pendingCount > 0
      ? t('offlineBanner.apiDownPending', { count: pendingCount })
      : t('offlineBanner.apiDown')
    : t('offlineBanner.offlineMode');

  return { offline, iconName, message, pendingCount };
};
