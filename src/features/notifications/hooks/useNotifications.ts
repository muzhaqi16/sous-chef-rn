import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from '#/i18n';
import { useApolloClient, useSubscription } from '@apollo/client/react';
import {
  NotificationEventsDocument,
  GetUnreadNotificationsDocument,
} from '#features/notifications/graphql/notifications.generated';
import {
  UseNotifications_NotificationFragmentDoc,
  type UseNotifications_NotificationFragment,
} from './useNotifications.generated';
import {
  NotificationType,
  NotificationCategory,
  NotificationSubtype,
  NotificationStatus,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import type { RootState } from '#store/index';
import { showLocalNotification } from '#utils/notifications/localNotificationHelper';
import { registerFcmTapHandlers } from '#/services/push/nativePushMessaging';
import { registerIosPushTapHandlers } from '#/services/push/iosPushMessaging';
import {
  getNotificationAction,
  getNotificationDisplayMessage,
  getNotificationTitle,
} from '#utils/notifications/notificationHelpers';
import {
  isNotificationPayload,
  type NotificationPayload,
} from '#store/slices/notificationSlice';
import {
  handleSubscriptionError,
  clearAllRetryStates,
} from '#utils/subscriptionErrorHandler';
import {
  addNotificationToFeed,
  evictNotification,
  writeNotificationStatus,
} from '#features/notifications/utils/notificationCacheWrites';
import { useNotificationSettings } from './useNotificationSettings';
import { useNotificationSync } from './useNotificationSync';
import { useSubscriptionTransportRecovery } from '#/hooks/subscriptions/useSubscriptionTransportRecovery';
import { logger } from '#/utils/environment';

// PERFORMANCE: Grouped selectors with useShallow keep store subscriptions low
// The listener needs the signed-in user and nothing else from the store; the
// notifications themselves live in the Apollo cache.
const selectListenerUser = (state: RootState) => state.user;

interface NotificationConfig {
  skip?: boolean;
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
}

/**
 * useNotificationListener — opens the consolidated `NotificationEvents`
 * subscription (CREATED + UPDATED on one stream, routed by `subtype`) and
 * processes incoming events into the notification store.
 *
 * Must be mounted exactly ONCE (by NotificationProvider). The server caps
 * concurrent subscriptions per client and Apollo does not dedupe identical
 * subscriptions, so a second mount opens another server subscription and
 * double-processes every event. Screens that need notification state should
 * use `useNotifications` instead — it reads the store without subscribing.
 */
export const useNotificationListener = (config: NotificationConfig = {}) => {
  const client = useApolloClient();
  const { t } = useTranslation();

  // Every server-delivered transition re-seeds the unread count instead of
  // applying a delta.
  //
  // A delta cannot be made idempotent on this path. The guard that makes the
  // local writes safe asks whether the row was unread BEFORE the change, and
  // here it can no longer tell: Apollo normalizes the event's `node` into the
  // cache before `onData` runs, so a READ event has already set the row to
  // READ by the time the handler looks. The row would move and the badge would
  // not — the exact disagreement `notificationCacheWrites` exists to prevent.
  //
  // Re-reading is also the more truthful answer: the badge counts every unread
  // notification, including ones this device has never paged in, so a local ±1
  // was only ever an approximation of it. An event arriving means the socket is
  // up, so the read is available.
  const reseedUnreadCount = () => {
    client
      .query({
        query: GetUnreadNotificationsDocument,
        fetchPolicy: 'network-only',
      })
      .catch(() => {
        // Transient failure: the foreground / WS-reconnect re-query paths
        // converge the feed later.
      });
  };

  // PERFORMANCE: Use ref instead of state for AppState to avoid re-renders
  const appStateRef = useRef(AppState.currentState);

  const user = useAppStore(selectListenerUser);

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
      priority?: Priority;
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
      priority: notification.priority ?? Priority.Normal,
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

    // The entity is already normalized — the subscription delivered it. What
    // is missing is the feed edge, scoped to the variants this notification
    // belongs to. The count is re-seeded from the server by the caller.
    addNotificationToFeed(
      client.cache,
      user?.id,
      processedNotification.id,
      category,
    );
    reseedUnreadCount();

    // Show push notification if enabled, app is not active, and not quiet time.
    // Android only: on iOS the OS already draws the APNs alert for the same
    // event, so an in-app Notifee draw here would double the tray entry.
    if (
      Platform.OS === 'android' &&
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

    logger.warn(`${subscriptionName} subscription error:`, error.message);
    handleSubscriptionError(subscriptionName, error);
  };

  // Consolidated notification stream — CREATED + UPDATED on one subscription,
  // routed by `subtype` (replaces notificationCreated + notificationUpdated).
  const notificationEventsSkip = config.skip || !user?.id;
  const notificationEvents = useSubscription(NotificationEventsDocument, {
    skip: notificationEventsSkip,
    onData: ({ data }) => {
      const event = data.data?.notificationEvents;
      if (!event) return;

      // Aggregate transitions (mark-all-read / clear-read / bulk-expire, e.g.
      // performed on another device) arrive with a null `node` and only an
      // `affectedCount` — the affected rows are unknown client-side, so
      // re-sync the unread feed rather than guessing which local entries
      // changed.
      if (
        event.subtype === NotificationSubtype.BulkRead ||
        event.subtype === NotificationSubtype.BulkCleared ||
        event.subtype === NotificationSubtype.BulkExpired
      ) {
        reseedUnreadCount();
        return;
      }

      const maskedNotification = event.node;
      if (!maskedNotification) return;

      // Dedicated read/dismiss transition subtypes only need the id — the
      // server routes these as READ / DISMISSED, never as UPDATED.
      if (event.subtype === NotificationSubtype.Read) {
        // Apollo's own write of the payload already carries this, but stating
        // it keeps the transition legible and covers a payload that omits it.
        writeNotificationStatus(
          client.cache,
          maskedNotification.id,
          NotificationStatus.Read,
        );
        reseedUnreadCount();
        return;
      }
      if (event.subtype === NotificationSubtype.Dismissed) {
        // Evicting rather than `applyNotificationRemoved`: the badge delta
        // that helper applies is the part that cannot be trusted here.
        evictNotification(client.cache, maskedNotification.id);
        reseedUnreadCount();
        return;
      }

      const rawNotification =
        client.cache.readFragment<UseNotifications_NotificationFragment>({
          fragment: UseNotifications_NotificationFragmentDoc,
          fragmentName: 'useNotifications_notification',
          from: { __typename: 'Notification', id: maskedNotification.id },
        });
      if (!rawNotification) return;

      if (event.subtype === NotificationSubtype.Created) {
        processNotification(
          {
            id: rawNotification.id,
            type: rawNotification.type,
            title:
              rawNotification.title ??
              getNotificationTitle(rawNotification.type),
            message: rawNotification.message ?? '',
            priority: rawNotification.priority ?? Priority.Normal,
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
      } else if (event.subtype === NotificationSubtype.Updated) {
        // Read/dismiss arrive as the dedicated subtypes handled above; the
        // only statuses still delivered as UPDATED are CLICKED and EXPIRED.
        const status = rawNotification.status;
        if (status === 'CLICKED') {
          writeNotificationStatus(
            client.cache,
            rawNotification.id,
            NotificationStatus.Read,
          );
          reseedUnreadCount();
        } else if (status === 'EXPIRED') {
          evictNotification(client.cache, rawNotification.id);
          reseedUnreadCount();
        }
      }
    },
    onError: (error: Error) => {
      handleError('NotificationEvents', error);
    },
  });
  useSubscriptionTransportRecovery(
    'NotificationEvents',
    notificationEvents,
    notificationEventsSkip,
  );

  // PERFORMANCE: App state handling - store in ref to avoid re-renders
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  // Route taps on OS-auto-displayed pushes (background tap + cold-launch): FCM
  // on Android, APNs on iOS. Each is platform-guarded, so both are safe to call.
  // Taps on data-only pushes we drew ourselves route through Notifee's handlers.
  //
  // Gated on authentication: registering synchronously consumes the one-shot
  // cold-start tap, so running it while logged out would drop a launch tap
  // before there is a session to route it into. The tap stays cached and is
  // consumed once the user is authenticated and this effect re-runs.
  useEffect(() => {
    if (config.skip || !user?.id) return;
    const unsubscribeFcm = registerFcmTapHandlers();
    const unsubscribeApns = registerIosPushTapHandlers();
    return () => {
      unsubscribeFcm();
      unsubscribeApns();
    };
  }, [config.skip, user?.id]);

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
  // Actions only. The feed itself comes from `useNotificationHistory`, which
  // reads the Apollo cache — this hook used to return a Zustand copy of it, and
  // a screen holding both had no rule for which one was current.
  const { syncMarkAsRead, syncDelete, syncMarkAllAsRead, syncClearRead } =
    useNotificationSync();

  return {
    handleMarkAsRead: syncMarkAsRead,
    handleMarkAllAsRead: syncMarkAllAsRead,
    handleRemoveNotification: syncDelete,
    handleClearRead: syncClearRead,
  };
};
