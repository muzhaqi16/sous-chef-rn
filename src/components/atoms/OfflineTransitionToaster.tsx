import { useEffect, useRef } from 'react';
import { useTranslation } from '#/i18n';
import { useOfflineStatus } from '#hooks/app/useOfflineStatus';
import { toastService } from '#/services/toastService';
import { TOAST } from '#/constants/animations';

/**
 * Announces offline/online transitions with a toast; renders nothing. Mounted
 * exactly once at the app root, so one toast per transition, and the
 * network-state subscription stays in a leaf instead of re-rendering the tree.
 */
export const OfflineTransitionToaster: React.FC = () => {
  const { t } = useTranslation();
  const { offline, message } = useOfflineStatus();

  // The guard requires `offline` to have flipped, so a `message` change (the
  // pending count ticking) re-runs the effect without re-firing the toast.
  const wasOfflineRef = useRef(offline);
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = offline;
    // `supersede`: these announce a state, so the newest must replace a displayed
    // or queued one rather than land seconds after the state it describes.
    if (offline && !wasOffline) {
      toastService.warning(message, {
        duration: TOAST.AUTO_DISMISS_LONG,
        supersede: true,
      });
    } else if (!offline && wasOffline) {
      toastService.success(t('offlineBanner.backOnline'), { supersede: true });
    }
  }, [offline, message, t]);

  return null;
};
