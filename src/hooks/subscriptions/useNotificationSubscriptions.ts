/**
 * Notification Subscriptions
 *
 * Previously managed the notificationChanged subscription via SubscriptionService.
 * That subscription is now handled directly by the useNotifications hook in
 * NotificationProvider, which processes and displays notifications.
 *
 * This hook is kept as a no-op placeholder since it's called from
 * AuthenticatedSubscriptions. It may be used for future notification
 * subscription channels.
 */

/**
 * Initialize notification subscriptions for the current user
 *
 * Note: The actual notificationChanged subscription is handled by
 * useNotifications hook in NotificationProvider to avoid duplicate
 * subscriptions and ensure proper notification processing.
 *
 * @param _userId - Current user ID (unused, kept for API compatibility)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useNotificationSubscriptions(userId?: string) {
  // No-op: notificationChanged is handled by useNotifications in NotificationProvider.
  // See useNotifications.ts lines 207-248 for the actual subscription handler.
}
