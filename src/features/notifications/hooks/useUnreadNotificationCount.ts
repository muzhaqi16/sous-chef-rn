/**
 * The unread badge count, read from the one place that holds it.
 *
 * `cache-only`: this is a badge on an unrelated screen, and the count is kept
 * current by the feed query, the subscription and every notification mutation.
 * Firing a network request from here would be a second fetch of something the
 * cache already knows, on a screen that never displays the notifications.
 */
import { useQuery } from '@apollo/client/react';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';

export function useUnreadNotificationCount(): number {
  const { data } = useQuery(GetUnreadNotificationsDocument, {
    fetchPolicy: 'cache-only',
  });
  return data?.me?.unreadNotificationCount ?? 0;
}
