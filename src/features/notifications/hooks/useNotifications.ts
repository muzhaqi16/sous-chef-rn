import { useTranslation } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import { useApolloClient, useSubscription } from '@apollo/client/react';
import type { ApolloClient } from '@apollo/client';
import {
  NotificationEventsDocument,
  GetUnreadNotificationsDocument,
  NotificationSummaryDocument,
} from '#features/notifications/graphql/notifications.generated';
import { NotificationForEventDocument } from './useNotifications.generated';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from './useNotificationsOnLaunch.generated';
import { fetchEventEntity } from '#/services/subscriptions/fetchEventEntity';
import {
  NotificationType,
  NotificationCategory,
  NotificationSubtype,
  NotificationStatus,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import type { RootState } from '#store/index';
import { requirePlatform } from '#platform/install';
import {
  getNotificationAction,
  getNotificationCopy,
  isTestNotification,
} from '#features/notifications/utils/notificationHelpers';
import type { NotificationCopyData } from '#features/notifications/types';
import { reportSubscriptionError } from '#utils/subscriptionErrorHandler';
import {
  addNotificationToFeed,
  evictNotification,
  writeNotificationStatus,
} from '#features/notifications/utils/notificationCacheWrites';
import { useNotificationSettings } from './useNotificationSettings';
import { useNotificationSync } from './useNotificationSync';
import { useSubscriptionTransportRecovery } from '#/hooks/subscriptions/useSubscriptionTransportRecovery';
import { logger } from '#/utils/environment';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { registerSessionTeardown } from '#store/sessionTeardown';
import { isNetworkError } from '#/utils/isNetworkError';

// PERFORMANCE: Grouped selectors with useShallow keep store subscriptions low
// The listener needs the signed-in user and nothing else from the store; the
// notifications themselves live in the Apollo cache.
const selectListenerUser = (state: RootState) => state.user;

/** A notification the person is told about while the app is away. */
export interface AwayNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
}

interface NotificationConfig {
  skip?: boolean;
  showInAppNotifications?: boolean;
  showPushNotifications?: boolean;
  /** Draws a notification that arrives while the app is away, outside quiet hours. */
  onArrivedWhileAway?: (notification: AwayNotification) => void;
}

/**
 * Coalesces the badge re-read so a burst of events costs one round trip. An
 * aggregate event re-reads the unread feed instead (its rows changed unnamed),
 * which states the badge too.
 */
const RESEED_DEBOUNCE_MS = 300;
let reseedTimer: ReturnType<typeof setTimeout> | null = null;
let reseedFeed = false;

const ignoreReseedFailure = (): void => {
  // Transient failure: the foreground / WS-reconnect re-query paths converge
  // the badge and the feed later.
};

const scheduleUnreadReseed = (
  client: ApolloClient,
  scope: 'badge' | 'feed',
): void => {
  if (scope === 'feed') reseedFeed = true;
  if (reseedTimer !== null) clearTimeout(reseedTimer);
  reseedTimer = setTimeout(() => {
    reseedTimer = null;
    const withFeed = reseedFeed;
    reseedFeed = false;
    if (withFeed) {
      client
        .query({
          query: GetUnreadNotificationsDocument,
          fetchPolicy: 'network-only',
        })
        .catch(ignoreReseedFailure);
    } else {
      client
        .query({
          query: NotificationSummaryDocument,
          fetchPolicy: 'network-only',
        })
        .catch(ignoreReseedFailure);
    }
  }, RESEED_DEBOUNCE_MS);
};

/** Test seam, and what stops a pending reseed outliving the session. */
export const cancelPendingUnreadReseed = (): void => {
  reseedFeed = false;
  if (reseedTimer === null) return;
  clearTimeout(reseedTimer);
  reseedTimer = null;
};

// A reseed parked in the debounce would otherwise fire after `clearStore()` and
// re-populate the cache for a session that has ended.
registerSessionTeardown('notification-reseed', cancelPendingUnreadReseed);

/**
 * Mounted exactly ONCE (by NotificationProvider): the server caps concurrent
 * subscriptions and Apollo does not dedupe them, so a second mount
 * double-processes every event. Screens read via `useNotifications`.
 */
export const useNotificationListener = (config: NotificationConfig = {}) => {
  const client = useApolloClient();
  const { t } = useTranslation();

  // Server events RESEED rather than apply a delta: Apollo normalizes `node`
  // before `onData`, so the "was it unread?" guard already sees the new value,
  // and the badge counts rows this device never paged in.
  const reseedUnreadCount = () => scheduleUnreadReseed(client, 'badge');

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

  // The preference that gates each type, as the API gates it
  // (`docs/api/notifications.md` § What each toggle sends).
  const isNotificationTypeEnabled = (type: NotificationType): boolean => {
    switch (type) {
      case NotificationType.NewItemAdded:
      case NotificationType.ItemUpdated:
      case NotificationType.ItemDeleted:
        return userPreferences.pantryChanges;
      case NotificationType.LowStock:
      case NotificationType.RunningLow:
        return userPreferences.lowStockAlerts;
      case NotificationType.ExpiryReminder:
        return userPreferences.expirationNotifications;
      case NotificationType.ListUpdated:
        return userPreferences.shoppingListUpdates;
      case NotificationType.SharedListChanged:
        return userPreferences.sharedListUpdates;
      case NotificationType.MealPlanReminder:
        return userPreferences.mealPlanReminders;
      case NotificationType.CookingReminder:
        return userPreferences.cookingReminders;
      case NotificationType.RecipeRecommendations:
        return userPreferences.recipeRecommendations;
      case NotificationType.WeeklyDigest:
        return userPreferences.weeklyDigest;
      case NotificationType.MonthlyReport:
        return userPreferences.monthlyReport;
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
      // A list's reminder date is sent whatever the toggles say.
      case NotificationType.ListReminder:
      case NotificationType.RecipeCooked:
      case NotificationType.RecipeSaved:
      default:
        return true;
    }
  };

  const processNotification = (
    notification: {
      id?: string;
      type?: NotificationType;
      priority?: Priority;
      data?: NotificationCopyData | null;
      isTest?: boolean;
      sentAt?: string;
      expiresAt?: string | null;
      sourceId?: string | null;
      sourceType?: string | null;
      actionUrl?: string | null;
      readAt?: string | null;
      isAuthoredContent?: boolean | null;
      title?: string | null;
      message?: string | null;
    },
    category: NotificationCategory,
    sourceUserId?: string,
  ) => {
    if (!finalConfig.showInAppNotifications) return;

    // Filter out notifications triggered by the current user
    if (sourceUserId && user?.id && sourceUserId === user.id) {
      return;
    }

    const resolvedType = notification.type ?? NotificationType.HomeJoined;

    // Check if notification type is enabled in user preferences
    if (!isNotificationTypeEnabled(resolvedType)) {
      return;
    }

    const { requiresAction, actionType } = getNotificationAction(resolvedType);

    const processedNotification = {
      id: notification.id ?? Date.now().toString(),
      type: resolvedType,
      category,
      priority: notification.priority ?? Priority.Normal,
      data: notification.data ?? null,
      isTest: notification.isTest,
      sentAt: notification.sentAt ?? new Date().toISOString(),
      expiresAt: notification.expiresAt,
      isRead: false,
      sourceId: notification.sourceId,
      sourceType: notification.sourceType,
      actionUrl: notification.actionUrl,
      readAt: notification.readAt,
      // An admin's announcement is drawn in their words; without these the
      // tray falls back to the template for its type.
      isAuthoredContent: notification.isAuthoredContent,
      title: notification.title,
      message: notification.message,
      requiresAction,
      actionType,
    };

    // The read-back normalized the row. What is missing is the feed edge,
    // scoped to the variants this notification belongs to. The count is
    // re-seeded from the server by the caller.
    addNotificationToFeed(
      client.cache,
      user?.id,
      processedNotification.id,
      category,
    );
    reseedUnreadCount();

    // Told about only while away and outside quiet hours; the host decides
    // how, if at all, to draw it.
    if (
      finalConfig.showPushNotifications &&
      requirePlatform('appLifecycle').current() !== 'active' &&
      !isQuietTime()
    ) {
      const copy = getNotificationCopy(processedNotification, t, todayKey());
      config.onArrivedWhileAway?.({
        id: processedNotification.id,
        category: processedNotification.category,
        title: copy.title,
        body: copy.message,
      });
    }
  };

  /** Reads a new row back, then adds it to the feed. */
  const addArrivedNotification = async (id: string) => {
    const data = await fetchEventEntity(
      client,
      NotificationForEventDocument,
      { id },
      'Notification',
    );
    // Offline, or gone before it could be read: the feed's next read has it.
    if (!data?.notification) return;
    const row =
      client.cache.readFragment<UseNotificationsOnLaunch_NotificationFragment>({
        fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
        fragmentName: 'useNotificationsOnLaunch_notification',
        from: { __typename: 'Notification', id },
      });
    if (!row) return;
    processNotification(
      {
        id: row.id,
        type: row.type,
        priority: row.priority,
        data: row.data,
        isTest: isTestNotification(row.payload),
        sentAt: row.sentAt,
        expiresAt: row.expiresAt,
        sourceId: row.sourceId,
        sourceType: row.sourceType,
        actionUrl: row.actionUrl,
        readAt: row.readAt,
        isAuthoredContent: row.isAuthoredContent,
        title: row.title,
        message: row.message,
      },
      row.category ?? NotificationCategory.System,
    );
  };

  // Transport churn auto-reconnects; only other failures are warned about.
  const handleError = (error: Error) => {
    const subscriptionName = operationNameOf(NotificationEventsDocument);
    if (!isNetworkError(error)) {
      logger.warn(`${subscriptionName} subscription error:`, error.message);
    }
    reportSubscriptionError(subscriptionName, error);
  };

  // Consolidated notification stream — CREATED + UPDATED on one subscription,
  // routed by `subtype` (replaces notificationCreated + notificationUpdated).
  const notificationEventsSkip = config.skip === true || !user?.id;
  const notificationEvents = useSubscription(NotificationEventsDocument, {
    skip: notificationEventsSkip,
    // The event carries the row's id and status only; a new row is read back.
    fetchPolicy: 'no-cache',
    onData: ({ data }) => {
      const event = data.data?.notificationEvents;
      if (!event) return;

      // Aggregate transitions carry a null `node` and only an `affectedCount`,
      // so the unread feed re-syncs rather than guessing which rows changed.
      if (
        event.subtype === NotificationSubtype.BulkRead ||
        event.subtype === NotificationSubtype.BulkCleared ||
        event.subtype === NotificationSubtype.BulkExpired
      ) {
        scheduleUnreadReseed(client, 'feed');
        return;
      }

      const { node } = event;
      if (!node) return;

      switch (event.subtype) {
        // Dedicated read/dismiss transition subtypes only need the id — the
        // server routes these as READ / DISMISSED, never as UPDATED.
        case NotificationSubtype.Read:
          writeNotificationStatus(
            client.cache,
            node.id,
            NotificationStatus.Read,
          );
          reseedUnreadCount();
          break;
        case NotificationSubtype.Dismissed:
          // Evicting rather than `applyNotificationRemoved`: the badge delta
          // that helper applies is the part that cannot be trusted here.
          evictNotification(client.cache, node.id);
          reseedUnreadCount();
          break;
        case NotificationSubtype.Created:
          void addArrivedNotification(node.id);
          break;
        case NotificationSubtype.Updated:
          // Read/dismiss arrive as the dedicated subtypes handled above; the
          // only statuses still delivered as UPDATED are CLICKED and EXPIRED.
          if (node.status === NotificationStatus.Clicked) {
            writeNotificationStatus(
              client.cache,
              node.id,
              NotificationStatus.Read,
            );
            reseedUnreadCount();
          } else if (node.status === NotificationStatus.Expired) {
            evictNotification(client.cache, node.id);
            reseedUnreadCount();
          }
          break;
      }
    },
    onError: (error: Error) => {
      handleError(error);
    },
  });
  useSubscriptionTransportRecovery(
    NotificationEventsDocument,
    notificationEvents,
    notificationEventsSkip,
  );
};

/**
 * Opens NO subscription: events arrive through `useNotificationListener`,
 * mounted once in NotificationProvider.
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
