import { useEffect, useState, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  useNotificationReceivedSubscription,
  useUrgentNotificationReceivedSubscription,
  useShoppingListItemsChangedSubscription,
  useShoppingListCollaboratorsChangedSubscription,
  useMyMembershipUpdatedSubscription,
  useMemberJoinedSubscription,
  NotificationType,
} from '#generated';
import { useStore } from '#store';
import { NotificationCategory as StoreNotificationCategory } from '#store/slices/notificationSlice';
import { showLocalNotification } from '#utils/notifications/localNotificationHelper';
import {
  getNotificationTitle,
  getNotificationMessage,
  getNotificationCategory,
} from '#utils/notifications/notificationParser';
import {
  NotificationCategory,
  NotificationPriority,
} from '#store/slices/notificationSlice';
import {
  handleSubscriptionError,
  clearAllRetryStates,
} from '#utils/subscriptionErrorHandler';
import { useNotificationSettings } from './useNotificationSettings';

interface NotificationConfig {
  enablePantryNotifications?: boolean;
  enableShoppingListNotifications?: boolean;
  enableMembershipNotifications?: boolean;
  enableLowStockAlerts?: boolean;
  enableExpirationAlerts?: boolean;
  enableCollaborationNotifications?: boolean;
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
}

export const useNotifications = (config: NotificationConfig = {}) => {
  const [appState, setAppState] = useState(AppState.currentState);
  const notifications = useStore(state => state.notifications);
  const addNotification = useStore(state => state.addNotification);
  const markAsRead = useStore(state => state.markAsRead);
  const removeNotification = useStore(state => state.removeNotification);
  const clearAll = useStore(state => state.clearAll);
  const getNotificationsByCategory = useStore(
    state => state.getNotificationsByCategory,
  );
  const selectedHomeId = useStore(state => state.selectedHomeId);
  const selectedShoppingListId = useStore(
    state => state.selectedShoppingListId,
  );
  const user = useStore(state => state.user);

  // Fetch user notification preferences
  const { settings: userPreferences, isQuietTime } = useNotificationSettings();

  // Default configuration
  const finalConfig = useMemo(
    () => ({
      enablePantryNotifications: true,
      enableShoppingListNotifications: true,
      enableMembershipNotifications: true,
      enableLowStockAlerts: true,
      enableExpirationAlerts: true,
      enableCollaborationNotifications: true,
      showInAppNotifications: true,
      showPushNotifications: true,
      ...config,
    }),
    [config],
  );

  const getPriorityFromType = useCallback(
    (type: NotificationType): NotificationPriority => {
      switch (type) {
        case NotificationType.ExpiryReminder:
        case NotificationType.LowStock:
          return NotificationPriority.MEDIUM;
        default:
          return NotificationPriority.LOW;
      }
    },
    [],
  );

  // Check if notification type is enabled in user preferences
  const isNotificationTypeEnabled = useCallback(
    (type: NotificationType): boolean => {
      if (!userPreferences) return true; // Show by default if preferences not loaded

      switch (type) {
        case NotificationType.ItemUpdated:
          return userPreferences.pantryChanges;
        case NotificationType.LowStock:
          return userPreferences.lowStockAlerts;
        case NotificationType.ExpiryReminder:
          return userPreferences.expirationNotifications;
        case NotificationType.ListUpdated:
          return (
            userPreferences.shoppingListUpdates ||
            userPreferences.sharedListUpdates
          );
        case NotificationType.CollaborationInvite:
          return userPreferences.collaborationInvites;
        case NotificationType.MembershipInvite:
        case NotificationType.HomeJoined:
          return userPreferences.homeInvites;
        default:
          return true; // Show unknown notification types by default
      }
    },
    [userPreferences],
  );

  const processNotification = useCallback(
    (
      notification: any,
      category: NotificationCategory,
      sourceUserId?: string,
    ) => {
      if (!finalConfig.showInAppNotifications) return;

      // Filter out notifications triggered by the current user
      if (sourceUserId && user?.id && sourceUserId === user.id) {
        console.log('🚫 Filtering notification - triggered by current user:', {
          type: notification.type,
          sourceUserId,
          currentUserId: user.id,
        });
        return;
      }

      // Check if notification type is enabled in user preferences
      if (!isNotificationTypeEnabled(notification.type)) {
        console.log(
          '🚫 Filtering notification - disabled in user preferences:',
          {
            type: notification.type,
          },
        );
        return;
      }

      // Check if it's quiet time (only affects push notifications)
      if (isQuietTime()) {
        console.log('🔕 Quiet time active - suppressing push notification:', {
          type: notification.type,
        });
        // Continue to show in-app notification but skip push
      }

      // Determine if notification requires action based on type
      const requiresAction =
        notification.type === NotificationType.MembershipInvite ||
        notification.type === NotificationType.CollaborationInvite;

      // Set action type based on notification type
      const actionType =
        notification.type === NotificationType.MembershipInvite
          ? 'ACCEPT_HOME_INVITE'
          : notification.type === NotificationType.CollaborationInvite
          ? 'ACCEPT_SHOPPING_LIST_INVITE'
          : undefined;

      const processedNotification = {
        id: notification.id || Date.now().toString(),
        type: notification.type || NotificationType.HomeJoined,
        title: notification.title || 'Notification',
        message: notification.message || '',
        category,
        priority: getPriorityFromType(notification.type),
        payload: notification.payload || {},
        sentAt: notification.sentAt || new Date().toISOString(),
        isRead: false,
        requiresAction,
        actionType,
        actionData: notification.payload,
      };

      addNotification(processedNotification);

      // Show push notification if enabled, app is not active, and not quiet time
      if (
        finalConfig.showPushNotifications &&
        appState !== 'active' &&
        !isQuietTime()
      ) {
        showLocalNotification({
          id: processedNotification.id,
          title: processedNotification.title,
          body: processedNotification.message,
        });
      }
    },
    [
      finalConfig,
      appState,
      addNotification,
      getPriorityFromType,
      user,
      isNotificationTypeEnabled,
      isQuietTime,
    ],
  );

  // Error handler
  const handleError = useCallback((subscriptionName: string, error: any) => {
    console.warn(`${subscriptionName} subscription error:`, error.message);
    handleSubscriptionError(subscriptionName, error);
  }, []);

  // General notifications
  useNotificationReceivedSubscription({
    skip: !user?.id,
    onData: ({ data }) => {
      console.log(
        '🔔 [NotificationReceived] Raw subscription data received:',
        data,
      );
      if (data.data?.notificationReceived?.notification) {
        const rawNotification = data.data.notificationReceived.notification;

        console.log('🔔 [NotificationReceived] Processing notification:', {
          type: rawNotification.type,
          id: rawNotification.id,
          payload: rawNotification.payload,
        });

        // Create properly structured notification using helper functions
        processNotification(
          {
            type: rawNotification.type,
            title: getNotificationTitle(
              rawNotification.type,
              rawNotification.payload,
            ),
            message: getNotificationMessage(
              rawNotification.type,
              rawNotification.payload,
            ),
            payload: rawNotification.payload,
            sentAt: rawNotification.sentAt,
          },
          getNotificationCategory(rawNotification.type),
        );
      } else {
        console.warn(
          '⚠️ [NotificationReceived] Data received but no notification payload',
        );
      }
    },
    onError: error => {
      console.error('❌ [NotificationReceived] Subscription error:', error);
      handleError('NotificationReceived', error);
    },
  });

  useUrgentNotificationReceivedSubscription({
    skip: !user?.id,
    onData: ({ data }) => {
      console.log(
        '🚨 [UrgentNotification] Raw subscription data received:',
        data,
      );
      if (data.data?.urgentNotificationReceived?.notification) {
        const rawNotification =
          data.data.urgentNotificationReceived.notification;

        console.log('🚨 [UrgentNotification] Processing urgent notification:', {
          type: rawNotification.type,
          id: rawNotification.id,
          payload: rawNotification.payload,
        });

        // Create properly structured notification using helper functions
        processNotification(
          {
            type: rawNotification.type,
            title: getNotificationTitle(
              rawNotification.type,
              rawNotification.payload,
            ),
            message: getNotificationMessage(
              rawNotification.type,
              rawNotification.payload,
            ),
            payload: rawNotification.payload,
            sentAt: rawNotification.sentAt,
          },
          getNotificationCategory(rawNotification.type),
        );
      }
    },
    onError: error => {
      console.error('❌ [UrgentNotification] Subscription error:', error);
      handleError('UrgentNotificationReceived', error);
    },
  });

  // Shopping list notifications
  useShoppingListItemsChangedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip:
      !user?.id ||
      !selectedShoppingListId ||
      !finalConfig.enableShoppingListNotifications,
    onData: ({ data }) => {
      if (data.data?.shoppingListItemsChanged) {
        const payload = data.data.shoppingListItemsChanged;
        processNotification(
          {
            type: NotificationType.ListUpdated,
            title: 'Shopping List Updated',
            message: 'Items in your shopping list have been updated',
            payload: payload,
            sentAt: new Date().toISOString(),
          },
          NotificationCategory.SHOPPING_LIST,
          payload.userId,
        );
      }
    },
    onError: error => handleError('ShoppingListItemsChanged', error),
  });

  useShoppingListCollaboratorsChangedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip:
      !user?.id ||
      !selectedShoppingListId ||
      !finalConfig.enableCollaborationNotifications,
    onData: ({ data }) => {
      if (data.data?.shoppingListCollaboratorsChanged) {
        const payload = data.data.shoppingListCollaboratorsChanged;
        processNotification(
          {
            type: NotificationType.CollaborationInvite,
            title: 'Collaborator Updated',
            message: 'Collaborators on your shopping list have been updated',
            payload: payload,
            sentAt: new Date().toISOString(),
          },
          NotificationCategory.SHOPPING_LIST,
          payload.userId,
        );
      }
    },
    onError: error => handleError('ShoppingListCollaboratorsChanged', error),
  });

  // Membership notifications
  useMyMembershipUpdatedSubscription({
    skip: !user?.id || !finalConfig.enableMembershipNotifications,
    onData: ({ data }) => {
      if (data.data?.myMembershipUpdated) {
        const payload = data.data.myMembershipUpdated;
        processNotification(
          {
            type: NotificationType.MembershipInvite,
            title: 'Membership Updated',
            message: 'Your membership status has been updated',
            payload: payload,
            sentAt: new Date().toISOString(),
          },
          NotificationCategory.MEMBERSHIP,
          payload.userId,
        );
      }
    },
    onError: error => handleError('MyMembershipUpdated', error),
  });

  useMemberJoinedSubscription({
    variables: { homeId: selectedHomeId || '' },
    skip:
      !user?.id ||
      !selectedHomeId ||
      !finalConfig.enableMembershipNotifications,
    onData: ({ data }) => {
      if (data.data?.memberJoined) {
        const payload = data.data.memberJoined;
        processNotification(
          {
            type: NotificationType.HomeJoined,
            title: 'New Member',
            message: 'A new member has joined your home',
            payload: payload,
            sentAt: new Date().toISOString(),
          },
          NotificationCategory.MEMBERSHIP,
          payload.userId,
        );
      }
    },
    onError: error => handleError('MemberJoined', error),
  });

  // App state handling
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  // Cleanup on logout
  useEffect(() => {
    if (!user?.id) {
      clearAllRetryStates();
    }
  }, [user?.id]);

  // Log subscription status for debugging
  useEffect(() => {
    if (user?.id) {
      console.log(
        '✅ [NotificationReceived] Subscription ACTIVE for user:',
        user.id,
      );
    } else {
      console.log(
        '⏸️ [NotificationReceived] Subscription SKIPPED - no user ID',
      );
    }
  }, [user?.id]);

  // Notification management handlers
  const handleMarkAsRead = useCallback(
    async (notificationId: string) => {
      markAsRead(notificationId);
    },
    [markAsRead],
  );

  const handleMarkAllAsRead = useCallback(async () => {
    notifications.forEach(notification => {
      if (!notification.isRead) {
        markAsRead(notification.id);
      }
    });
  }, [notifications, markAsRead]);

  const handleRemoveNotification = useCallback(
    async (notificationId: string) => {
      removeNotification(notificationId);
    },
    [removeNotification],
  );

  const handleClearAll = useCallback(async () => {
    clearAll();
  }, [clearAll]);

  const handleGetNotificationsByCategory = useCallback(
    (category: StoreNotificationCategory) => {
      return getNotificationsByCategory(category);
    },
    [getNotificationsByCategory],
  );

  return {
    appState,
    config: finalConfig,
    notifications,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleRemoveNotification,
    clearAll: handleClearAll,
    getNotificationsByCategory: handleGetNotificationsByCategory,
    updateConfig: (newConfig: Partial<NotificationConfig>) => {
      // This would typically update stored preferences
      console.log('Updating notification config:', newConfig);
    },
  };
};
