import { useEffect, useState, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  useNotificationReceivedSubscription,
  useUrgentNotificationReceivedSubscription,
  usePantryItemsChangedSubscription,
  usePantryLowStockAlertSubscription,
  usePantryExpiringItemsAlertSubscription,
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
  parseNotificationPayload,
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
  const getNotificationsByCategory = useStore(state => state.getNotificationsByCategory);
  const selectedHomeId = useStore(state => state.selectedHomeId);
  const selectedShoppingListId = useStore(state => state.selectedShoppingListId);
  const user = useStore(state => state.user);

  // Default configuration
  const finalConfig = useMemo(() => ({
    enablePantryNotifications: true,
    enableShoppingListNotifications: true,
    enableMembershipNotifications: true,
    enableLowStockAlerts: true,
    enableExpirationAlerts: true,
    enableCollaborationNotifications: true,
    showInAppNotifications: true,
    showPushNotifications: true,
    ...config,
  }), [config]);

  const getPriorityFromType = useCallback((type: NotificationType): NotificationPriority => {
    switch (type) {
      case NotificationType.ExpiryReminder:
      case NotificationType.LowStock:
        return NotificationPriority.MEDIUM;
      default:
        return NotificationPriority.LOW;
    }
  }, []);

  const processNotification = useCallback((notification: any, category: NotificationCategory) => {
    if (!finalConfig.showInAppNotifications) return;

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

    if (finalConfig.showPushNotifications && appState !== 'active') {
      showLocalNotification({
        id: processedNotification.id,
        title: processedNotification.title,
        body: processedNotification.message,
      });
    }
  }, [finalConfig, appState, addNotification, getPriorityFromType]);

  // Error handler
  const handleError = useCallback((subscriptionName: string, error: any) => {
    console.warn(`${subscriptionName} subscription error:`, error.message);
    handleSubscriptionError(subscriptionName, error);
  }, []);

  // General notifications
  useNotificationReceivedSubscription({
    skip: !user?.id,
    onData: ({ data }) => {
      console.log('🔔 [NotificationReceived] Raw subscription data received:', data);
      if (data.data?.notificationReceived?.notification) {
        const rawNotification = data.data.notificationReceived.notification;

        console.log('🔔 [NotificationReceived] Processing notification:', {
          type: rawNotification.type,
          id: rawNotification.id,
          payload: rawNotification.payload,
        });

        // Create properly structured notification using helper functions
        processNotification({
          type: rawNotification.type,
          title: getNotificationTitle(rawNotification.type, rawNotification.payload),
          message: getNotificationMessage(rawNotification.type, rawNotification.payload),
          payload: rawNotification.payload,
          sentAt: rawNotification.sentAt,
        }, getNotificationCategory(rawNotification.type));
      } else {
        console.warn('⚠️ [NotificationReceived] Data received but no notification payload');
      }
    },
    onError: (error) => {
      console.error('❌ [NotificationReceived] Subscription error:', error);
      handleError('NotificationReceived', error);
    },
  });

  useUrgentNotificationReceivedSubscription({
    skip: !user?.id,
    onData: ({ data }) => {
      console.log('🚨 [UrgentNotification] Raw subscription data received:', data);
      if (data.data?.urgentNotificationReceived?.notification) {
        const rawNotification = data.data.urgentNotificationReceived.notification;

        console.log('🚨 [UrgentNotification] Processing urgent notification:', {
          type: rawNotification.type,
          id: rawNotification.id,
          payload: rawNotification.payload,
        });

        // Create properly structured notification using helper functions
        processNotification({
          type: rawNotification.type,
          title: getNotificationTitle(rawNotification.type, rawNotification.payload),
          message: getNotificationMessage(rawNotification.type, rawNotification.payload),
          payload: rawNotification.payload,
          sentAt: rawNotification.sentAt,
        }, getNotificationCategory(rawNotification.type));
      }
    },
    onError: (error) => {
      console.error('❌ [UrgentNotification] Subscription error:', error);
      handleError('UrgentNotificationReceived', error);
    },
  });

  // Pantry notifications
  usePantryItemsChangedSubscription({
    variables: { pantryId: selectedHomeId || '' },
    skip: !user?.id || !selectedHomeId || !finalConfig.enablePantryNotifications,
    onData: ({ data }) => {
      if (data.data?.pantryItemsChanged) {
        processNotification({
          type: NotificationType.ItemUpdated,
          title: 'Pantry Updated',
          message: 'Items in your pantry have been updated',
          payload: data.data.pantryItemsChanged,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.PANTRY);
      }
    },
    onError: (error) => handleError('PantryItemsChanged', error),
  });

  usePantryLowStockAlertSubscription({
    variables: { pantryId: selectedHomeId || '' },
    skip: !user?.id || !selectedHomeId || !finalConfig.enableLowStockAlerts,
    onData: ({ data }) => {
      if (data.data?.pantryLowStockAlert) {
        processNotification({
          type: NotificationType.LowStock,
          title: 'Low Stock Alert',
          message: 'Some items in your pantry are running low',
          payload: data.data.pantryLowStockAlert,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.PANTRY);
      }
    },
    onError: (error) => handleError('PantryLowStockAlert', error),
  });

  usePantryExpiringItemsAlertSubscription({
    variables: { pantryId: selectedHomeId || '' },
    skip: !user?.id || !selectedHomeId || !finalConfig.enableExpirationAlerts,
    onData: ({ data }) => {
      if (data.data?.pantryExpiringItemsAlert) {
        processNotification({
          type: NotificationType.ExpiryReminder,
          title: 'Items Expiring Soon',
          message: 'Some items in your pantry will expire soon',
          payload: data.data.pantryExpiringItemsAlert,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.PANTRY);
      }
    },
    onError: (error) => handleError('PantryExpiringItemsAlert', error),
  });

  // Shopping list notifications
  useShoppingListItemsChangedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip: !user?.id || !selectedShoppingListId || !finalConfig.enableShoppingListNotifications,
    onData: ({ data }) => {
      if (data.data?.shoppingListItemsChanged) {
        processNotification({
          type: NotificationType.ListUpdated,
          title: 'Shopping List Updated',
          message: 'Items in your shopping list have been updated',
          payload: data.data.shoppingListItemsChanged,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.SHOPPING_LIST);
      }
    },
    onError: (error) => handleError('ShoppingListItemsChanged', error),
  });

  useShoppingListCollaboratorsChangedSubscription({
    variables: { listId: selectedShoppingListId || '' },
    skip: !user?.id || !selectedShoppingListId || !finalConfig.enableCollaborationNotifications,
    onData: ({ data }) => {
      if (data.data?.shoppingListCollaboratorsChanged) {
        processNotification({
          type: NotificationType.CollaborationInvite,
          title: 'Collaborator Updated',
          message: 'Collaborators on your shopping list have been updated',
          payload: data.data.shoppingListCollaboratorsChanged,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.SHOPPING_LIST);
      }
    },
    onError: (error) => handleError('ShoppingListCollaboratorsChanged', error),
  });

  // Membership notifications
  useMyMembershipUpdatedSubscription({
    skip: !user?.id || !finalConfig.enableMembershipNotifications,
    onData: ({ data }) => {
      if (data.data?.myMembershipUpdated) {
        processNotification({
          type: NotificationType.MembershipInvite,
          title: 'Membership Updated',
          message: 'Your membership status has been updated',
          payload: data.data.myMembershipUpdated,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.MEMBERSHIP);
      }
    },
    onError: (error) => handleError('MyMembershipUpdated', error),
  });

  useMemberJoinedSubscription({
    variables: { homeId: selectedHomeId || '' },
    skip: !user?.id || !selectedHomeId || !finalConfig.enableMembershipNotifications,
    onData: ({ data }) => {
      if (data.data?.memberJoined) {
        processNotification({
          type: NotificationType.HomeJoined,
          title: 'New Member',
          message: 'A new member has joined your home',
          payload: data.data.memberJoined,
          sentAt: new Date().toISOString(),
        }, NotificationCategory.MEMBERSHIP);
      }
    },
    onError: (error) => handleError('MemberJoined', error),
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
      console.log('✅ [NotificationReceived] Subscription ACTIVE for user:', user.id);
    } else {
      console.log('⏸️ [NotificationReceived] Subscription SKIPPED - no user ID');
    }
  }, [user?.id]);

  // Notification management handlers
  const handleMarkAsRead = useCallback(async (notificationId: string) => {
    markAsRead(notificationId);
  }, [markAsRead]);

  const handleMarkAllAsRead = useCallback(async () => {
    notifications.forEach(notification => {
      if (!notification.isRead) {
        markAsRead(notification.id);
      }
    });
  }, [notifications, markAsRead]);

  const handleRemoveNotification = useCallback(async (notificationId: string) => {
    removeNotification(notificationId);
  }, [removeNotification]);

  const handleClearAll = useCallback(async () => {
    clearAll();
  }, [clearAll]);

  const handleGetNotificationsByCategory = useCallback((category: StoreNotificationCategory) => {
    return getNotificationsByCategory(category);
  }, [getNotificationsByCategory]);

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