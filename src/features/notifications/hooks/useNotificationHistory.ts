/**
 * The notification feed and its counts — the ONLY source; it projects the
 * Apollo cache and holds nothing. The category filter is server-side, so the
 * screen must not filter again. `readFragment` per edge is required, not
 * indirection: `dataMasking` leaves `node` as `{ __typename, id }`.
 */

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from './useNotificationsOnLaunch.generated';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
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
  const pendingExpirationLinks = useNotificationStore(
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
