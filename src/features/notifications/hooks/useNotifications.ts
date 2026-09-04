import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useTranslation } from '#/i18n';
import { useApolloClient, useSubscription } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
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
import { showLocalNotification } from '#/services/notifications/localNotificationHelper';
import { registerFcmTapHandlers } from '#/services/push/nativePushMessaging';
import { registerIosPushTapHandlers } from '#/services/push/iosPushMessaging';
import {
  getNotificationAction,
  getNotificationDisplayMessage,
  getNotificationTitle,
} from '#features/notifications/utils/notificationHelpers';
import {
  isNotificationPayload,
  type NotificationPayload,
} from '#features/notifications/types';
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
import { registerSessionTeardown } from '#store/sessionTeardown';

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
 * Coalesces the unread-count reseed: `GetUnreadNotifications` pulls the first
 * 50 with the full fragment, so a burst would fire one round trip per event.
 */
const RESEED_DEBOUNCE_MS = 300;
let reseedTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleUnreadReseed = (client: ApolloClient): void => {
  if (reseedTimer !== null) clearTimeout(reseedTimer);
  reseedTimer = setTimeout(() => {
    reseedTimer = null;
    client
      .query({
        query: GetUnreadNotificationsDocument,
        fetchPolicy: 'network-only',
      })
      .catch(() => {
        // Transient failure: the foreground / WS-reconnect re-query paths
        // converge the feed later.
      });
  }, RESEED_DEBOUNCE_MS);
};

/** Test seam, and what stops a pending reseed outliving the session. */
export const cancelPendingUnreadReseed = (): void => {
  if (reseedTimer === null) return;
  clearTimeout(reseedTimer);
  reseedTimer = null;
};

// A reseed parked in the debounce would otherwise fire after `clearStore()` and
// re-populate the cache for a session that has ended.
registerSessionTeardown('notification-reseed', cancelPendingUnreadReseed);

/**
 * Opens the consolidated `NotificationEvents` subscription and processes its
 * events. Must be mounted exactly ONCE (by NotificationProvider): the server
 * caps concurrent subscriptions and Apollo does not dedupe them, so a second
 * mount double-processes every event. Screens read via `useNotifications`.
 */
export const useNotificationListener = (config: NotificationConfig = {}) => {
  const client = useApolloClient();
  const { t } = useTranslation();

  // Server-delivered transitions RESEED rather than apply a delta: Apollo
  // normalizes the event's `node` before `onData` runs, so the "was it unread?"
  // guard that makes local writes idempotent already sees the new value. The
  // badge also counts notifications this device never paged in, which a local
  // ±1 could only ever approximate.
  const reseedUnreadCount = () => scheduleUnreadReseed(client);

  // A ref, not state: AppState changes must not re-render this listener.
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

  // Taps on OS-displayed pushes (FCM/APNs, each platform-guarded); taps on
  // data-only pushes we drew go through Notifee. Gated on authentication —
  // registering consumes the one-shot cold-start tap synchronously, and while
  // logged out there is no session to route it into. It stays cached until this
  // effect re-runs.
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
  // Actions only. The feed comes from `useNotificationHistory`, which reads the
  // Apollo cache; a second copy here would leave a screen holding both with no
  // rule for which is current.
  const { syncMarkAsRead, syncDelete, syncMarkAllAsRead, syncClearRead } =
    useNotificationSync();

  return {
    handleMarkAsRead: syncMarkAsRead,
    handleMarkAllAsRead: syncMarkAllAsRead,
    handleRemoveNotification: syncDelete,
    handleClearRead: syncClearRead,
  };
};
