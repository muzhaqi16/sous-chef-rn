import { useNotificationStore } from '#features/notifications/store/notificationStore';
import type { ExpirationLinkData } from '#features/notifications/types';

/**
 * Attach expiration enrichment to a generic notification.
 *
 * The notifications feature's public write surface for its enrichment buffer.
 * `pantry` needs it because the two events it joins arrive on different
 * subscriptions — `PantryEvents` carries the expiration row, the notification
 * feed carries its partner — so the pantry subscription is where one half lands.
 *
 * A hook rather than a direct store import: `store/` is feature-private, and
 * top-level `hooks/` is a feature's public surface.
 */
export const useLinkExpirationData = (): ((
  genericNotificationId: string,
  expirationData: ExpirationLinkData,
) => void) => useNotificationStore(state => state.linkExpirationData);
