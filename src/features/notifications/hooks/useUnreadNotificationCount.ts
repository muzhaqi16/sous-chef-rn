/**
 * The unread badge count (`Query.notificationSummary`). `cache-only` — the feed
 * queries, the server-event re-read and every notification write's payload keep
 * it current, and this renders on screens that never display the notifications.
 */
import { useQuery } from '@apollo/client/react';
import { NotificationSummaryDocument } from '#features/notifications/graphql/notifications.generated';

export function useUnreadNotificationCount(): number {
  const { data } = useQuery(NotificationSummaryDocument, {
    fetchPolicy: 'cache-only',
  });
  return data?.notificationSummary.unreadCount ?? 0;
}
