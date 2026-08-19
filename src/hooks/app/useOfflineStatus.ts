import { useTranslation } from '#/i18n';
import type { Ionicons } from '@react-native-vector-icons/ionicons';
import { useAppStore } from '#store/useAppStore';
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
 *
 * The cause comes from the store's debounced `offlineBannerCause`, not from the
 * live flags — during the minimum-visible window after a recovery the live flags
 * already read "online", and re-deriving from them would rewrite the message
 * under the user mid-display.
 */
export const useOfflineStatus = (): OfflineStatus => {
  const { t } = useTranslation();
  const cause = useAppStore(state => state.offlineBannerCause);
  const pendingCount = usePendingMutationCount();

  const iconName: IoniconName =
    cause === 'offline-mode' ? 'airplane-outline' : 'cloud-offline-outline';

  const message =
    cause === 'device-offline'
      ? pendingCount > 0
        ? t('offlineBanner.deviceOfflinePending', { count: pendingCount })
        : t('offlineBanner.deviceOffline')
      : cause === 'api-unreachable'
      ? pendingCount > 0
        ? t('offlineBanner.apiDownPending', { count: pendingCount })
        : t('offlineBanner.apiDown')
      : t('offlineBanner.offlineMode');

  return { offline: cause !== null, iconName, message, pendingCount };
};
