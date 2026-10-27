import { useTranslation } from '#/i18n';
import { useAppStore } from '#store/useAppStore';
import { usePendingMutationCount } from '#/hooks/offline/usePendingMutationCount';
import { accessibilityLabelOf } from '#/utils/accessibilityLabel';
import type { IconName } from '#components/atoms/Icon';

type IoniconName = IconName;

export interface OfflineStatus {
  /** Whether the server can't currently be reached. */
  offline: boolean;
  /** Icon representing the current offline cause. */
  iconName: IoniconName;
  /** The current offline cause, short enough for a toast's first line. */
  title: string;
  /** What happens meanwhile, with the pending count when there is one. */
  detail: string;
  /** `title` and `detail` as one label, for a screen reader. */
  message: string;
  /** Count of mutations queued locally, waiting to sync. */
  pendingCount: number;
}

/**
 * The icon + copy for the current offline cause, shared by the pill and the
 * transition announcer so the two cannot drift. The cause is the store's DEBOUNCED
 * `offlineBannerCause`: during the minimum-visible window the live flags already
 * read "online", so re-deriving would rewrite the copy mid-display.
 */
export const useOfflineStatus = (): OfflineStatus => {
  const { t } = useTranslation();
  const cause = useAppStore(state => state.offlineBannerCause);
  const pendingCount = usePendingMutationCount();

  const iconName: IoniconName =
    cause === 'offline-mode' ? 'airplane-outline' : 'cloud-offline-outline';

  const title =
    cause === 'device-offline'
      ? t('offlineBanner.deviceOfflineTitle')
      : cause === 'api-unreachable'
      ? t('offlineBanner.apiDownTitle')
      : t('offlineBanner.offlineModeTitle');

  const detail =
    cause === 'device-offline'
      ? pendingCount > 0
        ? t('offlineBanner.deviceOfflinePendingDetail', { count: pendingCount })
        : t('offlineBanner.deviceOfflineDetail')
      : cause === 'api-unreachable'
      ? pendingCount > 0
        ? t('offlineBanner.apiDownPendingDetail', { count: pendingCount })
        : t('offlineBanner.apiDownDetail')
      : t('offlineBanner.offlineModeDetail');

  return {
    offline: cause !== null,
    iconName,
    title,
    detail,
    message: accessibilityLabelOf(title, detail),
    pendingCount,
  };
};
