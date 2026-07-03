import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useApolloClient, useSubscription } from '@apollo/client/react';
import { NotificationEventsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  UseNotifications_NotificationFragmentDoc,
  type UseNotifications_NotificationFragment,
} from './useNotifications.generated';
import {
  NotificationType,
  NotificationCategory,
  NotificationEventSubtype,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import type { RootState } from '#store/index';
import { useShallow } from 'zustand/react/shallow';
import { showLocalNotification } from '#utils/notifications/localNotificationHelper';
import { registerFcmTapHandlers } from '#/services/push/nativePushMessaging';
import {
  getNotificationAction,
  getNotificationDisplayMessage,
  getNotificationTitle,
} from '#utils/notifications/notificationHelpers';
import {
  NotificationPriority,
  isNotificationPayload,
  type NotificationPayload,
} from '#store/slices/notificationSlice';
import {
  handleSubscriptionError,
  clearAllRetryStates,
} from '#utils/subscriptionErrorHandler';
import { useNotificationSettings } from './useNotificationSettings';
import { useNotificationSync } from './useNotificationSync';

// PERFORMANCE: Grouped selectors with useShallow keep store subscriptions low
const selectListenerState = (state: RootState) => ({
  user: state.user,
  addNotification: state.addNotification,
  markAsRead: state.markAsRead,
  removeNotification: state.removeNotification,
});

const selectNotificationsState = (state: RootState) => ({
  notifications: state.notifications,
  clearAll: state.clearAll,
  getNotificationsByCategory: state.getNotificationsByCategory,
});

interface NotificationConfig {
  skip?: boolean;
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
}

/**
 * useNotificationListener — opens the NotificationCreated / NotificationUpdated
 * subscriptions and processes incoming events into the notification store.
 *
 * Must be mounted exactly ONCE (by NotificationProvider). The server caps
 * concurrent subscriptions per client and Apollo does not dedupe identical
 * subscriptions, so a second mount opens two more server subscriptions and
 * double-processes every event. Screens that need notification state should
 * use `useNotifications` instead — it reads the store without subscribing.
 */
export const useNotificationListener = (config: NotificationConfig = {}) => {
  const client = useApolloClient();
  const { t } = useTranslation();

  // PERFORMANCE: Use ref instead of state for AppState to avoid re-renders
  const appStateRef = useRef(AppState.currentState);

  const { user, addNotification, markAsRead, removeNotification } = useAppStore(
    useShallow(selectListenerState),
  );

  // Fetch user notification preferences (deferred when hook is skipped)
  const { settings: userPreferences, isQuietTime } = useNotificationSettings({
    skip: config.skip,
  });

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
    notification: {
      id?: string;
      type?: NotificationType;
      title?: string;
      message?: string;
      priority?: NotificationPriority;
      payload?: JsonValue | null;
      sentAt?: string;
      expiresAt?: string | null;
      sourceId?: string | null;
      sourceType?: string | null;
      actionUrl?: string | null;
      readAt?: string | null;
    },
    category: NotificationCategory,
    sourceUserId?: string,
  ) => {
    // Narrow the untyped JSON payload to NotificationPayload at the boundary.
    const payload: NotificationPayload = isNotificationPayload(
      notification.payload,
    )
      ? notification.payload
      : {};
    if (!finalConfig.showInAppNotifications) return;

    // Filter out notifications triggered by the current user
    if (sourceUserId && user?.id && sourceUserId === user.id) {
      return;
    }

    const resolvedType = notification.type || NotificationType.HomeJoined;

    // Check if notification type is enabled in user preferences
    if (!isNotificationTypeEnabled(resolvedType)) {
      return;
    }

    const { requiresAction, actionType } = getNotificationAction(resolvedType);

    const processedNotification = {
      id: notification.id || Date.now().toString(),
      type: resolvedType,
      title: notification.title || getNotificationTitle(resolvedType),
      message: notification.message || '',
      category,
      priority: notification.priority ?? NotificationPriority.MEDIUM,
      payload,
      sentAt: notification.sentAt || new Date().toISOString(),
      expiresAt: notification.expiresAt,
      isRead: false,
      sourceId: notification.sourceId,
      sourceType: notification.sourceType,
      actionUrl: notification.actionUrl,
      readAt: notification.readAt,
      requiresAction,
      actionType,
      actionData: payload,
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
        body: getNotificationDisplayMessage(processedNotification, t),
        data: {
          category: processedNotification.category,
          notificationId: processedNotification.id,
        },
      });
    }
  };

  // Error handler - suppresses expected network errors
  const handleError = (subscriptionName: string, error: Error) => {
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

  // Consolidated notification stream — CREATED + UPDATED on one subscription,
  // routed by `subtype` (replaces notificationCreated + notificationUpdated).
  useSubscription(NotificationEventsDocument, {
    skip: config.skip || !user?.id,
    onData: ({ data }) => {
      const event = data.data?.notificationEvents;
      const maskedNotification = event?.node;
      if (!event || !maskedNotification) return;

      const rawNotification =
        client.cache.readFragment<UseNotifications_NotificationFragment>({
          fragment: UseNotifications_NotificationFragmentDoc,
          fragmentName: 'useNotifications_notification',
          from: { __typename: 'Notification', id: maskedNotification.id },
        });
      if (!rawNotification) return;

      if (event.subtype === NotificationEventSubtype.Created) {
        // New notification (RECEIVED equivalent)
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
            sourceId: rawNotification.sourceId,
            sourceType: rawNotification.sourceType,
            actionUrl: rawNotification.actionUrl,
            readAt: rawNotification.readAt,
          },
          rawNotification.category ?? NotificationCategory.System,
        );
      } else if (event.subtype === NotificationEventSubtype.Updated) {
        // Status changes — read, dismissed, expired
        const status = rawNotification.status;
        if (status === 'READ' || status === 'CLICKED') {
          markAsRead(rawNotification.id);
        } else if (status === 'DISMISSED' || status === 'EXPIRED') {
          removeNotification(rawNotification.id);
        }
      }
    },
    onError: (error: Error) => {
      handleError('NotificationEvents', error);
    },
  });

  // PERFORMANCE: App state handling - store in ref to avoid re-renders
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Route taps on OS-auto-displayed FCM pushes (background tap + cold-launch).
  // Taps on data-only pushes we drew ourselves route through Notifee's handlers.
  useEffect(() => {
    const unsubscribe = registerFcmTapHandlers();
    return unsubscribe;
  }, []);

  // Cleanup on logout
  useEffect(() => {
    if (!user?.id) {
      clearAllRetryStates();
    }
  }, [user?.id]);
};

/**
 * useNotifications — notification state + server-synced actions for screens.
 *
 * Reads the store only; does NOT open subscriptions. Real-time events are
 * delivered by `useNotificationListener`, mounted once in NotificationProvider.
 */
export const useNotifications = () => {
  const { notifications, clearAll, getNotificationsByCategory } = useAppStore(
    useShallow(selectNotificationsState),
  );

  // Server-synced notification actions
  const { syncMarkAsRead, syncDelete, syncMarkAllAsRead } =
    useNotificationSync();

  return {
    notifications,
    handleMarkAsRead: syncMarkAsRead,
    handleMarkAllAsRead: syncMarkAllAsRead,
    handleRemoveNotification: syncDelete,
    clearAll,
    getNotificationsByCategory,
  };
};
