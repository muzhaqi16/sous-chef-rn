/**
 * The notification feed — the ONLY source; it projects the Apollo cache and
 * holds nothing. The category filter is server-side, so the screen must not
 * filter again. Each row is read live: `dataMasking` leaves `node` as
 * `{ __typename, id }`, and marking one read changes only its own fields.
 */

import { loadPageWithCursorRecovery } from '#hooks/utils/cursorRecovery';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { NetworkStatus } from '@apollo/client';
import { skipToken, useQuery } from '@apollo/client/react';
import { useFragmentList } from '#hooks/apollo/useFragmentList';
import { GetNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from './useNotificationsOnLaunch.generated';
import type { NotificationCategory } from '#/graphql/generated/schemaTypes';
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
  const pendingExpirationLinks = useNotificationStore(
    state => state.pendingExpirationLinks,
  );

  const { data, error, loading, fetchMore, networkStatus, refetch } = useQuery(
    GetNotificationsDocument,
    enabled
      ? {
          variables: {
            filter: category ? { category } : undefined,
            first: PAGE_SIZE,
          },
        }
      : skipToken,
  );

  useApolloErrorLogger(GetNotificationsDocument, error);

  const connection = data?.me?.notificationsConnection;

  const entries = useFragmentList({
    fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
    fragmentName: 'useNotificationsOnLaunch_notification',
    from: connection?.edges.map(edge => edge.node) ?? [],
  });
  const notifications: DisplayNotification[] = entries
    .filter(
      (n): n is UseNotificationsOnLaunch_NotificationFragment => n !== null,
    )
    .map(n => toDisplayNotification(n, pendingExpirationLinks[n.id]));

  const hasMore = connection?.pageInfo.hasNextPage ?? false;
  const endCursor = connection?.pageInfo.endCursor ?? null;

  const loadMore = () => {
    if (!hasMore || !endCursor || loading) return;
    // No local cap. The store capped at MAX_NOTIFICATIONS and evicted the
    // oldest, so paging past it fetched rows that could never become visible;
    // the cache has no such ceiling and the connection merges by node id.
    void loadPageWithCursorRecovery({
      fetchMore,
      refetch,
      variables: {
        filter: category ? { category } : undefined,
        first: PAGE_SIZE,
        after: endCursor,
      },
      operation: 'NotificationHistory.loadMore',
    });
  };

  return {
    notifications,
    loadMore,
    loadingMore: networkStatus === NetworkStatus.fetchMore,
    loading,
    error,
    // `data !== undefined` — a response arrived, empty or not. Separates "no
    // notifications" from "the feed could not be loaded".
    hasResult: data !== undefined,
    refetch,
  };
}
