import { useNotificationStore } from '#features/notifications/store/notificationStore';
import type { ExpirationLinkData } from '#features/notifications/types';

/**
 * The feature's public write surface for its enrichment buffer — a hook rather
 * than a store import because `store/` is feature-private. `pantry` needs it:
 * the two events being joined arrive on different subscriptions.
 */
export const useLinkExpirationData = (): ((
  genericNotificationId: string,
  expirationData: ExpirationLinkData,
) => void) => useNotificationStore(state => state.linkExpirationData);
