/**
 * Notification Subscriptions
 *
 * Centralizes all notification-related subscriptions using the unified
 * SubscriptionService. Handles real-time updates for:
 * - General notifications
 * - Urgent notifications
 * - Notification status updates
 *
 * NOTE: These subscriptions use CacheStrategy.NONE because notifications
 * are typically stored in Redux/Zustand, not Apollo cache. The actual
 * notification display logic remains in useNotifications hook.
 */

import {
  useNotificationReceivedSubscription,
  useUrgentNotificationReceivedSubscription,
  useNotificationUpdatedSubscription,
} from '#generated';
import { subscriptionService } from '#/services/subscriptions';
import { CacheStrategy } from '#/services/subscriptions/types';

/**
 * Initialize notification subscriptions for the current user
 *
 * This hook should be called once at the app level (in SubscriptionProvider)
 * It handles real-time notification delivery.
 *
 * The actual notification processing and display logic is handled by
 * the useNotifications hook in NotificationProvider.
 *
 * @param userId - Current user ID for deduplication
 */
export function useNotificationSubscriptions(userId?: string) {
  //
  // NOTE: NotificationReceived subscription is NOT registered here
  // to avoid duplicate subscription conflicts.
  //
  // The NotificationReceived subscription is handled directly in the
  // useNotifications hook (via NotificationProvider) because it requires
  // immediate processing and display logic that can't be handled by
  // SubscriptionService with CacheStrategy.NONE.
  //
  // Registering the same subscription in both places causes Apollo Client
  // to only trigger one handler, and the SubscriptionService handler
  // (which only logs data) prevents the actual notification processing
  // from occurring.
  //
  // The useNotifications hook properly:
  // - Parses notification payloads
  // - Adds notifications to Zustand store
  // - Triggers in-app notification displays
  // - Handles push notification permissions
  // - Processes COLLABORATION_INVITE and HOME_INVITATION types
  //

  //
  // Urgent Notification Received Subscription
  // High-priority notifications that need immediate attention
  //
  const urgentHandlers = subscriptionService.register({
    subscriptionName: 'UrgentNotificationReceived',
    entityType: 'Notification',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useUrgentNotificationReceivedSubscription({
    skip: !userId,
    ...urgentHandlers,
  });

  //
  // Notification Updated Subscription
  // Handles status changes (read/unread, dismissed, etc.)
  //
  const updatedHandlers = subscriptionService.register({
    subscriptionName: 'NotificationUpdated',
    entityType: 'Notification',
    enableDeduplication: true,
    userId,
    cacheUpdateStrategy: CacheStrategy.NONE,
    enableLogging: true,
  });

  useNotificationUpdatedSubscription({
    skip: !userId,
    ...updatedHandlers,
  });

  // Note: The useNotifications hook in NotificationProvider will handle
  // the actual notification display and processing. This hook only
  // manages the subscription connections.
}
