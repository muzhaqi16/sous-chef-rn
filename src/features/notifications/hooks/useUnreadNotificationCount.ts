/**
 * The unread badge count (`Query.notificationSummary`). Asks nothing on mount:
 * the feed queries, the server-event re-read and every write's payload keep it
 * current. Not held to the cache, so the default `nextFetchPolicy` lets a resync
 * re-read it, which is how the badge recovers from an event missed while away.
 */
import { useQuery } from '@apollo/client/react';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { NotificationSummaryDocument } from '#features/notifications/graphql/notifications.generated';

export function useUnreadNotificationCount(): number {
  const { data, error } = useQuery(NotificationSummaryDocument, {
    fetchPolicy: 'cache-only',
  });
  useApolloErrorLogger(NotificationSummaryDocument, error);
  return data?.notificationSummary.unreadCount ?? 0;
}
