/**
 * useNotificationHistory
 *
 * Loads the paginated notification *history* (read + unread) for the feed and
 * feeds it into the Zustand store. Complements useNotificationsOnLaunch (which
 * only loads unread for the badge/startup): this powers the full feed, so read
 * history is present after a cache clear and can be paged with `loadMore`.
 *
 * The category filter is applied server-side (via the query's `filter` var), so
 * switching category re-queries that slice rather than filtering a partial
 * local list.
 */

import { useEffect } from 'react';
import { useApolloClient, useQuery } from '@apollo/client/react';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from './useNotificationsOnLaunch.generated';
import { NotificationCategory } from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import { useStore } from '#store';
import { MAX_NOTIFICATIONS } from '#store/slices/notificationSlice';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { mapNotificationToStore } from '#features/notifications/utils/mapNotificationToStore';

const PAGE_SIZE = 30;

export function useNotificationHistory(
  category: NotificationCategory | null,
  enabled: boolean,
) {
  const client = useApolloClient();
  const addMultipleNotifications = useAppStore(
    state => state.addMultipleNotifications,
  );
  const setServerNotificationCounts = useAppStore(
    state => state.setServerNotificationCounts,
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

  useEffect(() => {
    if (!me) return;
    const edges = connection?.edges;
    if (edges && edges.length > 0) {
      const items = edges
        .map(edge =>
          client.cache.readFragment<UseNotificationsOnLaunch_NotificationFragment>(
            {
              fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
              fragmentName: 'useNotificationsOnLaunch_notification',
              from: { __typename: 'Notification', id: edge.node.id },
            },
          ),
        )
        .filter(
          (n): n is UseNotificationsOnLaunch_NotificationFragment => n !== null,
        )
        .map(mapNotificationToStore);
      if (items.length > 0) addMultipleNotifications(items);
    }

    // Seed the badge from the server's authoritative totals AFTER the list
    // materializes — addMultipleNotifications recomputes counts from the local
    // list, which would clobber a seed written first. Mirrors
    // useNotificationsOnLaunch so history and launch agree on the count.
    setServerNotificationCounts(
      me.unreadNotificationCount,
      me.hasUrgentNotifications,
    );
  }, [
    me,
    connection,
    client,
    addMultipleNotifications,
    setServerNotificationCounts,
  ]);

  const hasMore = connection?.pageInfo?.hasNextPage ?? false;
  const endCursor = connection?.pageInfo?.endCursor ?? null;

  const loadMore = () => {
    if (!hasMore || !endCursor || loading) return;
    // The feed renders from the store, which caps at MAX_NOTIFICATIONS and
    // evicts the oldest entries — pages fetched past the cap can never become
    // visible, so stop paging instead of fetching into eviction.
    if (useStore.getState().notifications.length >= MAX_NOTIFICATIONS) {
      return;
    }
    fetchMore({
      variables: {
        filter: category ? { category } : undefined,
        first: PAGE_SIZE,
        after: endCursor,
      },
    });
  };

  return {
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
