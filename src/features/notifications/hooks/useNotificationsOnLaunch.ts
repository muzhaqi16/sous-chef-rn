/**
 * Loads unread notifications on startup, re-querying on foreground and on WS
 * reconnect to catch events that arrived while the subscription was down. The
 * query is the whole hook — Apollo normalizes the rows and the badge
 * aggregates, so nothing here may keep a second copy.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useLazyQuery } from '@apollo/client/react';
import { GetUnreadNotificationsDocument } from '#features/notifications/graphql/notifications.generated';
import { useDeferredCallback } from '#features/notifications/hooks/useDeferredCallback';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import { onWebSocketReconnected } from '#/apollo/links/wsLink';
import { errorService } from '#/services/errorService';

const reportUnreadFetchFailure = (error: unknown) =>
  errorService.reportError(error, {
    operation: 'NotificationsOnLaunch.fetchUnread',
  });

export function useNotificationsOnLaunch(userId?: string) {
  const hasFetchedRef = useRef(false);

  const [fetchUnreadNotifications, { error }] = useLazyQuery(
    GetUnreadNotificationsDocument,
    {},
  );

  const fetch = () => {
    if (!userId) return;
    hasFetchedRef.current = true;
    void fetchUnreadNotifications().catch(reportUnreadFetchFailure);
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
        void fetchUnreadNotifications().catch(reportUnreadFetchFailure);
      }
    });
    return () => sub.remove();
  }, [fetchUnreadNotifications]);

  // Backfill on WS reconnect: the subscription can miss events while the socket
  // is down, so re-pull unread when it comes back (not only on foreground).
  useEffect(() => {
    return onWebSocketReconnected(() => {
      if (hasFetchedRef.current)
        void fetchUnreadNotifications().catch(reportUnreadFetchFailure);
    });
  }, [fetchUnreadNotifications]);

  useApolloErrorLogger(GetUnreadNotificationsDocument, error);
}
