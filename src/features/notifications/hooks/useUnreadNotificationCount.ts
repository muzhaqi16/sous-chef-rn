/**
 * The unread badge count. `cache-only` — the feed query, the subscription and
 * every notification mutation keep it current, and this renders on screens that
 * never display the notifications themselves.
 */
import { useQuery } from '@apollo/client/react';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';

export function useUnreadNotificationCount(): number {
  const { data } = useQuery(GetUnreadNotificationsDocument, {
    fetchPolicy: 'cache-only',
  });
  return data?.me?.unreadNotificationCount ?? 0;
}
