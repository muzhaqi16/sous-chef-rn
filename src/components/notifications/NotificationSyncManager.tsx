import {useEffect} from 'react';
import {useStore} from '#store';
import {useGetMyNotificationsQuery} from '#generated';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';

interface UseNotificationSyncProps {
  userId?: string;
}

export const useNotificationSync = ({userId}: UseNotificationSyncProps) => {
  const syncNotificationsFromServer = useStore(
    state => state.syncNotificationsFromServer,
  );
  const cleanupOrphanedSubscriptions = useStore(
    state => state.cleanupOrphanedSubscriptions,
  );
  const selectedHomeId = useStore(state => state.selectedHomeId);
  const selectedPantryId = useStore(state => state.selectedPantryId);
  const selectedShoppingListId = useStore(
    state => state.selectedShoppingListId,
  );

  // Fetch notifications from server
  const {data: serverNotifications, refetch} = useGetMyNotificationsQuery({
    skip: !userId,
  });

  // Sync server notifications to local store using server-first approach
  useEffect(() => {
    if (serverNotifications?.myNotifications?.edges) {
      const serverNotifs = serverNotifications.myNotifications.edges.map(
        edge => {
          const node = edge.node;
          return {
            id: node.id,
            type: node.type,
            category: getCategoryFromNotificationType(node.type),
            priority: NotificationPriority.MEDIUM,
            title: getNotificationTitle(node.type, node.payload),
            message: getNotificationMessage(node.type, node.payload),
            payload: node.payload,
            sentAt: node.sentAt,
            readAt: node.readAt,
            isRead: Boolean(node.readAt), // Proper read state sync
            requiresAction: node.type === 'HOME_INVITATION',
            actionType:
              node.type === 'HOME_INVITATION'
                ? 'ACCEPT_HOME_INVITE'
                : undefined,
            source: 'server' as const, // Mark as server notifications
          };
        },
      );

      syncNotificationsFromServer(serverNotifs); // Use server-first sync
    }
  }, [serverNotifications, syncNotificationsFromServer]);

  // Periodic cleanup to ensure data consistency
  useEffect(() => {
    // Run cleanup when user context changes (home, pantry, shopping list selection)
    cleanupOrphanedSubscriptions();
  }, [
    selectedHomeId,
    selectedPantryId,
    selectedShoppingListId,
    cleanupOrphanedSubscriptions,
  ]);

  // Helper functions for server notifications
  const getCategoryFromNotificationType = (
    type: string,
  ): NotificationCategory => {
    switch (type) {
      case 'HOME_INVITATION':
        return NotificationCategory.MEMBERSHIP;
      case 'EXPIRY_REMINDER':
        return NotificationCategory.PANTRY;
      case 'LOW_STOCK':
        return NotificationCategory.PANTRY;
      default:
        return NotificationCategory.SYSTEM;
    }
  };

  const getNotificationTitle = (type: string, payload: any): string => {
    switch (type) {
      case 'HOME_INVITATION':
        return 'Home Invitation';
      case 'EXPIRY_REMINDER':
        return 'Items Expiring Soon';
      case 'LOW_STOCK':
        return 'Low Stock Alert';
      default:
        return 'Notification';
    }
  };

  const getNotificationMessage = (type: string, payload: any): string => {
    switch (type) {
      case 'HOME_INVITATION':
        return `You've been invited to join ${payload?.homeName || 'a home'}`;
      case 'EXPIRY_REMINDER':
        return `${payload?.itemCount || 'Some'} items are expiring soon`;
      case 'LOW_STOCK':
        return `${payload?.itemCount || 'Some'} items are running low`;
      default:
        return 'You have a new notification';
    }
  };

  // Return refetch function for parent components
  return {refetch};
};
