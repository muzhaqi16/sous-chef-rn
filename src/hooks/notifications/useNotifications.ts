import { useEffect, useMemo, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import {
  useNotificationReceivedSubscription,
  useUrgentNotificationReceivedSubscription,
  NotificationType,
} from '#generated';
import { useStore } from '#store';
import { useShallow } from 'zustand/react/shallow';
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
import { serializeError } from '#/utils/errorSerialization';
import { useNotificationSettings } from './useNotificationSettings';

// PERFORMANCE: Grouped selectors to reduce subscriptions from 7 to 2
const selectNotificationState = (state: any) => ({
  notifications: state.notifications,
  user: state.user,
});

const selectNotificationActions = (state: any) => ({
  addNotification: state.addNotification,
  markAsRead: state.markAsRead,
  removeNotification: state.removeNotification,
  clearAll: state.clearAll,
  getNotificationsByCategory: state.getNotificationsByCategory,
});

interface NotificationConfig {
  skip?: boolean;
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
  // PERFORMANCE: Use ref instead of state for AppState to avoid re-renders
  // AppState is only needed in side effect (push notification check), not for rendering
  const appStateRef = useRef(AppState.currentState);

  // PERFORMANCE: Use grouped selectors with useShallow to reduce subscriptions (7 → 2)
  const { notifications, user } = useStore(useShallow(selectNotificationState));
  const {
    addNotification,
    markAsRead,
    removeNotification,
    clearAll,
    getNotificationsByCategory,
  } = useStore(useShallow(selectNotificationActions));

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
        case NotificationType.HomeInvitation:
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
        notification.type === NotificationType.HomeInvitation ||
        notification.type === NotificationType.CollaborationInvite;

      // Set action type based on notification type
      const actionType =
        notification.type === NotificationType.MembershipInvite ||
        notification.type === NotificationType.HomeInvitation
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
        appStateRef.current !== 'active' &&
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
    skip: config.skip || !user?.id,
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
      console.error('❌ [NotificationReceived] Subscription error:', serializeError(error));
      handleError('NotificationReceived', error);
    },
  });

  useUrgentNotificationReceivedSubscription({
    skip: config.skip || !user?.id,
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
      console.error('❌ [UrgentNotification] Subscription error:', serializeError(error));
      handleError('UrgentNotificationReceived', error);
    },
  });

  // PERFORMANCE: App state handling - store in ref to avoid re-renders
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });
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

  // PERFORMANCE: Use store getter instead of stale notifications array in closure
  const handleMarkAllAsRead = useCallback(async () => {
    const currentNotifications = useStore.getState().notifications;
    currentNotifications.forEach(notification => {
      if (!notification.isRead) {
        markAsRead(notification.id);
      }
    });
  }, [markAsRead]);

  // PERFORMANCE: Optimize callback references - remove unnecessary wrappers
  return {
    config: finalConfig,
    notifications,
    handleMarkAsRead: markAsRead, // Direct reference instead of wrapper
    handleMarkAllAsRead,
    handleRemoveNotification: removeNotification, // Direct reference instead of wrapper
    clearAll, // Direct reference instead of wrapper
    getNotificationsByCategory, // Direct reference instead of wrapper
    updateConfig: (newConfig: Partial<NotificationConfig>) => {
      // This would typically update stored preferences
      console.log('Updating notification config:', newConfig);
    },
  };
};
