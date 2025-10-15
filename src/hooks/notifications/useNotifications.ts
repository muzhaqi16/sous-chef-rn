import {useCallback, useMemo} from 'react';
import {useStore} from '#store';
import {
  useMarkNotificationAsReadMutation,
  useDeleteNotificationMutation,
} from '#generated';

export const useNotifications = () => {
  const notifications = useStore(state => state.notifications);
  const unreadCount = useStore(state => state.unreadCount);
  const markAsRead = useStore(state => state.markAsRead);
  const markAllAsRead = useStore(state => state.markAllAsRead);
  const removeNotification = useStore(state => state.removeNotification);
  const clearAll = useStore(state => state.clearAll);
  const getNotificationsByCategory = useStore(
    state => state.getNotificationsByCategory,
  );

  const [markNotificationReadMutation] = useMarkNotificationAsReadMutation();
  const [deleteNotificationMutation] = useDeleteNotificationMutation();

  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      // Find the notification to check its source
      const notification = notifications.find(n => n.id === notificationId);
      
      // Mark locally
      markAsRead(notificationId);

      // Sync with server only if it's a server notification
      if (notification?.source === 'server') {
        try {
          await markNotificationReadMutation({
            variables: {id: notificationId},
          });
        } catch (error) {
          console.error('Failed to mark notification as read:', error);
        }
      }
    },
    [markAsRead, markNotificationReadMutation, notifications],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead);

    // Mark all locally
    markAllAsRead();

    // Sync with server for server notifications only
    for (const notification of unreadNotifications) {
      if (notification.source === 'server') {
        try {
          await markNotificationReadMutation({
            variables: {id: notification.id},
          });
        } catch (error) {
          console.error(`Failed to mark notification ${notification.id} as read:`, error);
        }
      }
    }
  }, [notifications, markAllAsRead, markNotificationReadMutation]);

  const handleRemoveNotification = useCallback(
    async (notificationId: string) => {
      // Find the notification to check its source
      const notification = notifications.find(n => n.id === notificationId);
      
      // Remove locally
      removeNotification(notificationId);

      // Delete from server only if it's a server notification
      if (notification?.source === 'server') {
        try {
          await deleteNotificationMutation({
            variables: {id: notificationId},
          });
        } catch (error) {
          console.error('Failed to delete notification:', error);
        }
      }
    },
    [removeNotification, deleteNotificationMutation, notifications],
  );

  const groupedNotifications = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: {[key: string]: typeof notifications} = {
      today: [],
      yesterday: [],
      older: [],
    };

    notifications.forEach(notification => {
      const notificationDate = new Date(notification.sentAt);

      if (notificationDate.toDateString() === today.toDateString()) {
        groups.today.push(notification);
      } else if (notificationDate.toDateString() === yesterday.toDateString()) {
        groups.yesterday.push(notification);
      } else {
        groups.older.push(notification);
      }
    });

    return groups;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    groupedNotifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleRemoveNotification,
    clearAll,
    getNotificationsByCategory,
  };
};
