import { useEffect } from 'react';
import { useAppStore } from '#store/useAppStore';
import { useGetMyNotificationsQuery } from '#generated';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';

interface UseNotificationSyncProps {
  userId?: string;
}

export const useNotificationSync = ({ userId }: UseNotificationSyncProps) => {
  const syncNotificationsFromServer = useAppStore(
    state => state.syncNotificationsFromServer,
  );
  const cleanupOrphanedSubscriptions = useAppStore(
    state => state.cleanupOrphanedSubscriptions,
  );
  const selectedHomeId = useAppStore(state => state.selectedHomeId);
  const selectedPantryId = useAppStore(state => state.selectedPantryId);
  const selectedShoppingListId = useAppStore(
    state => state.selectedShoppingListId,
  );

  // Fetch notifications from server
  const { data: serverNotifications, refetch } = useGetMyNotificationsQuery({
    skip: !userId,
  });

  // Helper functions for server notifications
  const getCategoryFromNotificationType = (
    type: string,
  ): NotificationCategory => {
    switch (type) {
      case 'HOME_INVITATION':
        return NotificationCategory.MEMBERSHIP;
      case 'COLLABORATION_INVITE':
        return NotificationCategory.COLLABORATION;
      case 'EXPIRY_REMINDER':
        return NotificationCategory.PANTRY;
      case 'LOW_STOCK':
        return NotificationCategory.PANTRY;
      default:
        return NotificationCategory.SYSTEM;
    }
  };

  const getNotificationTitle = (type: string): string => {
    switch (type) {
      case 'HOME_INVITATION':
        return 'Home Invitation';
      case 'COLLABORATION_INVITE':
        return 'Shopping List Invitation';
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
      case 'COLLABORATION_INVITE':
        return `${payload?.inviterName || 'Someone'} invited you to collaborate on "${payload?.listName || 'a shopping list'}"`;
      case 'EXPIRY_REMINDER':
        return `${payload?.itemCount || 'Some'} items are expiring soon`;
      case 'LOW_STOCK':
        return `${payload?.itemCount || 'Some'} items are running low`;
      default:
        return 'You have a new notification';
    }
  };

  // Sync server notifications to local store using server-first approach
  useEffect(() => {
    if (serverNotifications?.me?.notificationsConnection?.edges) {
      const serverNotifs = serverNotifications.me.notificationsConnection.edges.map(
        (edge: any) => {
          const node = edge.node;
          return {
            id: node.id,
            type: node.type,
            category: getCategoryFromNotificationType(node.type),
            priority: NotificationPriority.MEDIUM,
            title: getNotificationTitle(node.type),
            message: getNotificationMessage(node.type, node.payload),
            payload: node.payload,
            sentAt: node.sentAt,
            readAt: node.readAt,
            isRead: Boolean(node.readAt), // Proper read state sync
            requiresAction:
              node.type === 'HOME_INVITATION' ||
              node.type === 'COLLABORATION_INVITE',
            actionType:
              node.type === 'HOME_INVITATION'
                ? 'ACCEPT_HOME_INVITE'
                : node.type === 'COLLABORATION_INVITE'
                  ? 'ACCEPT_SHOPPING_LIST_INVITE'
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

  // Return refetch function for parent components
  return { refetch };
};
