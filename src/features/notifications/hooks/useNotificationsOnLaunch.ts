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
import {
  NotificationCategory,
  Priority,
} from '#/graphql/generated/schemaTypes';
import { useAppStore } from '#store/useAppStore';
import {
  NotificationPriority,
  type NotificationItem,
} from '#store/slices/notificationSlice';
import { useDeferredCallback } from '#hooks/performance/useDeferredCallback';
import { useApolloErrorLogger } from '#hooks/apollo/useApolloErrorLogger';
import {
  getNotificationAction,
  getNotificationTitle,
} from '#utils/notifications/notificationHelpers';

export function useNotificationsOnLaunch(userId?: string) {
  const client = useApolloClient();
  const addMultipleNotifications = useAppStore(
    state => state.addMultipleNotifications,
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

  useApolloErrorLogger('GetUnreadNotifications', error);

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
            from: edge.node,
          },
        ),
      )
      .filter(
        (n): n is UseNotificationsOnLaunch_NotificationFragment => n !== null,
      )
      .map(n => {
        const type = n.type;
        const payload = (n.payload ?? {}) as Record<string, unknown>;

        const { requiresAction, actionType } = getNotificationAction(type);

        // Map server Priority enum → store NotificationPriority
        const sp = n.priority;
        const priority =
          sp === Priority.High
            ? NotificationPriority.HIGH
            : sp === Priority.Urgent
            ? NotificationPriority.URGENT
            : sp === Priority.Low
            ? NotificationPriority.LOW
            : NotificationPriority.MEDIUM;

        return {
          id: n.id,
          type,
          title: n.title ?? getNotificationTitle(type),
          message: n.message ?? '',
          category: n.category ?? NotificationCategory.System,
          priority,
          payload,
          sentAt: n.sentAt,
          expiresAt: n.expiresAt,
          requiresAction,
          actionType,
          actionData: payload,
        };
      });

    if (notifications.length === 0) return;
    addMultipleNotifications(notifications);
  }, [data, addMultipleNotifications, client]);
}
