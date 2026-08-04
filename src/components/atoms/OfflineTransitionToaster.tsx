import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOfflineStatus } from '#hooks/app/useOfflineStatus';
import { toastService } from '#/services/toastService';
import { TOAST } from '#/constants/animations';

/**
 * Announces offline/online transitions with a transient toast. Renders nothing.
 *
 * Mounted exactly once at the app root so the toast fires a single time per
 * transition — the persistent, per-screen signal is `OfflineStatusPill`, which
 * lives inline in each screen's header. Isolating the network-state
 * subscription here (a leaf that renders null) keeps offline toggles from
 * re-rendering the whole app tree.
 */
export const OfflineTransitionToaster: React.FC = () => {
  const { t } = useTranslation();
  const { offline, message } = useOfflineStatus();

  // Announce only the on/off transition. The guard requires `offline` to have
  // actually flipped, so the effect re-running when `message` changes (e.g. the
  // pending count ticks) never re-fires the toast.
  const wasOfflineRef = useRef(offline);
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = offline;
    // `supersede`: these announce a state, so the newest replaces a displayed or
    // queued one instead of waiting behind it — otherwise toggling off right
    // after on showed the second toast only once the first had run its full
    // duration, seconds after the state it described.
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
