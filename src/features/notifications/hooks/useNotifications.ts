import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSubscription } from '@apollo/client/react';
import { NotificationChangedDocument } from '#features/notifications/graphql/notifications.generated';
import {
  NotificationType,
  NotificationCategory,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { showLocalNotification } from '#utils/notifications/localNotificationHelper';
import {
  getNotificationAction,
  getNotificationTitle,
} from '#utils/notifications/notificationHelpers';
import { NotificationPriority } from '#store/slices/notificationSlice';
import {
  handleSubscriptionError,
  clearAllRetryStates,
} from '#utils/subscriptionErrorHandler';
import { useNotificationSettings } from './useNotificationSettings';
import { useNotificationSync } from './useNotificationSync';

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
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
}

export const useNotifications = (config: NotificationConfig = {}) => {
  // PERFORMANCE: Use ref instead of state for AppState to avoid re-renders
  const appStateRef = useRef(AppState.currentState);

  // PERFORMANCE: Use grouped selectors with useShallow to reduce subscriptions (7 → 2)
  const { notifications, user } = useAppStore(
    useShallow(selectNotificationState),
  );
  const {
    addNotification,
    markAsRead,
    removeNotification,
    clearAll,
    getNotificationsByCategory,
  } = useAppStore(useShallow(selectNotificationActions));

  // Fetch user notification preferences (deferred when hook is skipped)
  const { settings: userPreferences, isQuietTime } = useNotificationSettings({
    skip: config.skip,
  });

  // Server-synced notification actions
  const { syncMarkAsRead, syncDelete, syncMarkAllAsRead } =
    useNotificationSync();

  // Default configuration
  const finalConfig = {
    showInAppNotifications: true,
    showPushNotifications: true,
    ...config,
  };

  // Check if notification type is enabled in user preferences
  const isNotificationTypeEnabled = (type: NotificationType): boolean => {
    if (!userPreferences) return true;

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
      case NotificationType.CollaborationAccepted:
      case NotificationType.CollaborationDeclined:
      case NotificationType.CollaboratorRemoved:
      case NotificationType.CollaboratorRoleChanged:
      case NotificationType.CollaboratorPermissionsUpdated:
        return userPreferences.collaborationInvites;
      case NotificationType.MembershipInvite:
      case NotificationType.HomeInvitation:
      case NotificationType.HomeJoined:
        return userPreferences.homeInvites;
      case NotificationType.RecipeCooked:
        return userPreferences.cookingReminders;
      case NotificationType.RecipeSaved:
        return userPreferences.recipeRecommendations;
      default:
        return true;
    }
  };

  const processNotification = (
    notification: any,
    category: NotificationCategory,
    sourceUserId?: string,
  ) => {
    if (!finalConfig.showInAppNotifications) return;

    // Filter out notifications triggered by the current user
    if (sourceUserId && user?.id && sourceUserId === user.id) {
      return;
    }

    // Check if notification type is enabled in user preferences
    if (!isNotificationTypeEnabled(notification.type)) {
      return;
    }

    const { requiresAction, actionType } = getNotificationAction(
      notification.type,
    );

    const resolvedType = notification.type || NotificationType.HomeJoined;
    const processedNotification = {
      id: notification.id || Date.now().toString(),
      type: resolvedType,
      title: notification.title || getNotificationTitle(resolvedType),
      message: notification.message || '',
      category,
      priority: notification.priority ?? NotificationPriority.MEDIUM,
      payload: notification.payload || {},
      sentAt: notification.sentAt || new Date().toISOString(),
      expiresAt: notification.expiresAt,
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
  };

  // Error handler - suppresses expected network errors
  const handleError = (subscriptionName: string, error: any) => {
    const errorMessage = error?.message?.toLowerCase() || '';
    const isSocketClosed = errorMessage.includes('socket closed');
    const isNetworkError =
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('websocket');

    // Socket closed errors are expected during network transitions - will auto-reconnect
    if (isSocketClosed || isNetworkError) {
      return;
    }

    console.warn(`${subscriptionName} subscription error:`, error.message);
    handleSubscriptionError(subscriptionName, error);
  };

  // General notifications
  useSubscription(NotificationChangedDocument, {
    skip: config.skip || !user?.id,
    onData: ({ data }) => {
      if (data.data?.notificationChanged?.notification) {
        const rawNotification = data.data.notificationChanged.notification;
        const changeType = data.data.notificationChanged.changeType;

        if (changeType === 'RECEIVED') {
          // Map server Priority enum → store NotificationPriority
          const sp = rawNotification.priority;
          const mappedPriority =
            sp === Priority.High
              ? NotificationPriority.HIGH
              : sp === Priority.Urgent
              ? NotificationPriority.URGENT
              : sp === Priority.Low
              ? NotificationPriority.LOW
              : NotificationPriority.MEDIUM;

          processNotification(
            {
              id: rawNotification.id,
              type: rawNotification.type,
              title:
                rawNotification.title ??
                getNotificationTitle(rawNotification.type),
              message: rawNotification.message ?? '',
              priority: mappedPriority,
              payload: rawNotification.payload,
              sentAt: rawNotification.sentAt,
              expiresAt: rawNotification.expiresAt,
            },
            rawNotification.category ?? NotificationCategory.System,
          );
        } else if (changeType === 'UPDATED') {
          const status = rawNotification.status;
          if (status === 'READ' || status === 'CLICKED') {
            markAsRead(rawNotification.id);
          } else if (status === 'DISMISSED' || status === 'EXPIRED') {
            removeNotification(rawNotification.id);
          }
        }
      }
    },
    onError: (error: Error) => {
      handleError('NotificationChanged', error);
    },
  });

  // PERFORMANCE: App state handling - store in ref to avoid re-renders
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
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

  return {
    config: finalConfig,
    notifications,
    handleMarkAsRead: syncMarkAsRead,
    handleMarkAllAsRead: syncMarkAllAsRead,
    handleRemoveNotification: syncDelete,
    clearAll,
    getNotificationsByCategory,
  };
};
