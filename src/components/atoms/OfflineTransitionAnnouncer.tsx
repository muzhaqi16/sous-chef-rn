import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useTranslation } from '#/i18n';
import { useOfflineStatus } from '#hooks/ui/useOfflineStatus';

/**
 * Reads offline/online transitions to a screen reader; renders nothing. The
 * header's offline icon is the only visual cue. Mounted once at the app root,
 * so a transition is read once however many headers are mounted.
 */
export const OfflineTransitionAnnouncer: React.FC = () => {
  const { t } = useTranslation();
  const { offline, message } = useOfflineStatus();

  // The guard requires `offline` to have flipped, so a `message` change (the
  // pending count ticking) re-runs the effect without a second announcement.
  const wasOfflineRef = useRef(offline);
  useEffect(() => {
    const wasOffline = wasOfflineRef.current;
    wasOfflineRef.current = offline;
    if (offline && !wasOffline) {
      AccessibilityInfo.announceForAccessibility(message);
    } else if (!offline && wasOffline) {
      AccessibilityInfo.announceForAccessibility(t('offlineBanner.backOnline'));
    }
  }, [offline, message, t]);

  return null;
};
