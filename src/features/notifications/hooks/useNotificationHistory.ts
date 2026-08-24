/**
 * The notification feed: the paginated history (read + unread), its unread and
 * urgent counts, and `loadMore`.
 *
 * This is the ONLY source of the feed. It used to copy every page into a
 * Zustand slice that the screen then read from, which meant a live event, an
 * optimistic read and a refetch each had two places to land and no rule about
 * which won. The notifications live in the Apollo cache; this hook projects
 * them for rendering and holds nothing.
 *
 * The category filter is applied server-side (via the query's `filter` var), so
 * switching category re-queries that slice rather than filtering a partial
 * local list — which is also why the screen no longer filters again on top.
 *
 * `readFragment` per edge is not indirection: `dataMasking` hides the spread
 * fragment's fields from the query result, so the edge's `node` is
 * `{ __typename, id }` until it is read back through the fragment that declared
 * them.
 */

import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from './useNotificationsOnLaunch.generated';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  toDisplayNotification,
  type DisplayNotification,
} from '#features/notifications/utils/toDisplayNotification';

const PAGE_SIZE = 30;

export function useNotificationHistory(
  category: NotificationCategory | null,
  enabled: boolean,
) {
  const client = useApolloClient();
  const pendingExpirationLinks = useAppStore(
    state => state.pendingExpirationLinks,
  );

  const { data, error, loading, fetchMore, networkStatus, refetch } = useQuery(
    GetNotificationsDocument,
    {
      variables: {
        filter: category ? { category } : undefined,
        first: PAGE_SIZE,
      },
      skip: !enabled,
      notifyOnNetworkStatusChange: true,
    },
  );

  useApolloErrorLogger('GetNotifications', error);

  const me = data?.me;
  const connection = me?.notificationsConnection;

  const notifications: DisplayNotification[] = (connection?.edges ?? [])
    .map(edge =>
      client.cache.readFragment<UseNotificationsOnLaunch_NotificationFragment>({
        fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
        fragmentName: 'useNotificationsOnLaunch_notification',
        from: { __typename: 'Notification', id: edge.node.id },
      }),
    )
    .filter(
      (n): n is UseNotificationsOnLaunch_NotificationFragment => n !== null,
    )
    .map(n => toDisplayNotification(n, pendingExpirationLinks[n.id]));

  const hasMore = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;

  const loadMore = () => {
    if (!hasMore || !endCursor || loading) return;
    // No local cap. The store capped at MAX_NOTIFICATIONS and evicted the
    // oldest, so paging past it fetched rows that could never become visible;
    // the cache has no such ceiling and the connection merges by node id.
    fetchMore({
      variables: {
        filter: category ? { category } : undefined,
        first: PAGE_SIZE,
        after: endCursor,
      },
    });
  };

  return {
    notifications,
    unreadCount: me?.unreadNotificationCount ?? 0,
    hasUrgent: me?.hasUrgentNotifications ?? false,
    loadMore,
    hasMore,
    // networkStatus 3 = fetchMore in flight.
    loadingMore: networkStatus === 3,
    loading,
    error,
    // `data !== undefined` — a response arrived, empty or not. Separates "no
    // notifications" from "the feed could not be loaded".
    hasResult: data !== undefined,
    refetch,
  };
}
