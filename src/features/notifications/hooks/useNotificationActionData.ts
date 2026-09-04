import { useApolloClient } from '@apollo/client/react';
import { GetExpirationNotificationsForPantryItemDocument } from '#features/notifications/graphql/expirationNotificationLookup.generated';
import { readExpiryReminderFields } from '#features/notifications/utils/notificationHelpers';
import type { DisplayNotification } from '#features/notifications/utils/toDisplayNotification';
import { errorService } from '#/services/errorService';
import { useNotificationSync } from '#features/notifications/hooks/useNotificationSync';

/** The cache reads and writes a notification's action buttons need. */
export function useNotificationActionData() {
  const client = useApolloClient();
  const { syncDelete } = useNotificationSync();

  /**
   * Find the expiration record behind a generic notification. `pantryItemId`
   * comes from the payload rather than sourceId/sourceType, which alias either
   * PantryItem or PantryItemBatch depending on which server path fired.
   */
  const resolveExpirationLink = async (notification: DisplayNotification) => {
    const pantryItemId = readExpiryReminderFields(
      notification.payload,
    )?.pantryItemId;
    if (!pantryItemId) return null;

    let result;
    try {
      result = await client.query({
        query: GetExpirationNotificationsForPantryItemDocument,
        variables: { pantryItemId },
        fetchPolicy: 'network-only',
      });
    } catch (error) {
      // Leaving `result` undefined resolves to no link, which is the correct
      // outcome when the lookup cannot be made.
      errorService.reportError(error, {
        operation: 'resolveExpirationNotificationLink',
      });
    }

    const edges = result?.data?.me?.expirationNotificationsConnection.edges;
    const match = edges?.find(
      edge => edge.node.genericNotificationId === notification.id,
    );
    return match?.node ?? null;
  };

  /**
   * Drop a notification from the feed so its modal cannot be re-opened. Through
   * `syncDelete`, not a bare cache write: the server still holds the row, so a
   * local-only removal returns on the next cold start — and an invite that
   * returns without its token can never be actioned from this device again.
   */
  const removeNotification = (notificationId: string) => {
    void syncDelete(notificationId);
  };

  return { resolveExpirationLink, removeNotification };
}
