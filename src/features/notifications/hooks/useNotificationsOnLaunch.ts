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
 * Re-queries when the app returns to foreground, and when the WebSocket
 * reconnects, to catch events that arrived while the subscription was down.
 *
 * The query is the whole hook: Apollo normalizes the notifications and the
 * `User.unreadNotificationCount` / `hasUrgentNotifications` aggregates into the
 * cache on its own. This used to map every edge and push it into a Zustand
 * slice, then re-seed the badge from the same response — a second copy of what
 * the cache already held, and the reason a live event and a refetch could leave
 * two different answers on screen.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useLazyQuery } from '@apollo/client/react';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { useDeferredCallback } from '#hooks/performance/useDeferredCallback';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { onWebSocketReconnected } from '#/apollo/links/wsLink';

export function useNotificationsOnLaunch(userId?: string) {
  const hasFetchedRef = useRef(false);

  const [fetchUnreadNotifications, { error }] = useLazyQuery(
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
}
