/**
 * useNotificationsOnLaunch Hook
 *
 * Loads all unread notifications from the server on app startup via
 * notificationsConnection — the API-recommended approach for initial load.
 *
 * Replaces the previous useAllPendingInvites approach which:
 * - Only fetched invite-type notifications (missed expiry, low-stock, etc.)
 * - Constructed composite IDs like `home-invite-${inviteId}`
 *
 * Now all unread notifications arrive with real server CUIDs so
 * markNotificationAsRead works correctly for every type.
 *
 * Re-queries when the app returns to foreground to catch missed
 * events that arrived while the subscription was disconnected.
 * Store deduplication in addMultipleNotifications prevents duplicates.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useApolloClient, useLazyQuery } from '@apollo/client/react';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from './useNotificationsOnLaunch.generated';
import { useAppStore } from '#store/useAppStore';
import { type NotificationItem } from '#store/slices/notificationSlice';
import { useDeferredCallback } from '#hooks/performance/useDeferredCallback';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { mapNotificationToStore } from '#features/notifications/utils/mapNotificationToStore';
import { onWebSocketReconnected } from '#/apollo/links/wsLink';

export function useNotificationsOnLaunch(userId?: string) {
  const client = useApolloClient();
  const addMultipleNotifications = useAppStore(
    state => state.addMultipleNotifications,
  );
  const setServerNotificationCounts = useAppStore(
    state => state.setServerNotificationCounts,
  );

  const hasFetchedRef = useRef(false);

  const [fetchUnreadNotifications, { data, error }] = useLazyQuery(
    GetUnreadNotificationsDocument,
    {},
  );

  const fetch = () => {
    if (!userId) return;
    hasFetchedRef.current = true;
    fetchUnreadNotifications();
  };

  // PERFORMANCE: Defer 10 s to avoid competing with screen-critical queries at startup
  useDeferredCallback(fetch, !!userId, 10000);

  // Reset on logout so the query runs again on next login
  useEffect(() => {
    if (!userId) {
      hasFetchedRef.current = false;
    }
  }, [userId]);

  // Re-query on foreground to catch notifications missed while offline/backgrounded
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active' && hasFetchedRef.current) {
        fetchUnreadNotifications();
      }
    });
    return () => sub.remove();
  }, [fetchUnreadNotifications]);

  // Backfill on WS reconnect: the subscription can miss events while the socket
  // is down, so re-pull unread when it comes back (not only on foreground).
  useEffect(() => {
    return onWebSocketReconnected(() => {
      if (hasFetchedRef.current) fetchUnreadNotifications();
    });
  }, [fetchUnreadNotifications]);

  useApolloErrorLogger('GetUnreadNotifications', error);

  // Seed the badge from the server's authoritative totals on every fetch
  // (mount / foreground). Runs even when there are zero unread so the badge
  // clears correctly — kept separate from the list-materialize effect below,
  // which early-returns on an empty page.
  useEffect(() => {
    const me = data?.me;
    if (!me) return;
    setServerNotificationCounts(
      me.unreadNotificationCount,
      me.hasUrgentNotifications,
    );
  }, [data, setServerNotificationCounts]);

  useEffect(() => {
    const edges = data?.me?.notificationsConnection?.edges;
    if (!edges || edges.length === 0) return;

    // Materialize each masked node ref via cache.readFragment so the hook can
    // read the fields it pushes into the Zustand store.
    const notifications: Omit<NotificationItem, 'isRead'>[] = edges
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

    if (notifications.length === 0) return;
    addMultipleNotifications(notifications);
  }, [data, addMultipleNotifications, client]);
}
