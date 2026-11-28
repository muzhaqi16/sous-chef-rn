import { useFragment, useQuery } from '@apollo/client/react';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useDataState, type DataState } from '#hooks/data/useDataState';
import { UseNotificationsOnLaunch_NotificationFragmentDoc } from './useNotificationsOnLaunch.generated';
import { NotificationDetailDocument } from './useNotificationDetail.generated';
import {
  toDisplayNotification,
  type DisplayNotification,
} from '#features/notifications/utils/toDisplayNotification';

interface NotificationDetail {
  notification: DisplayNotification | undefined;
  /** Why there is no notification to show: still loading, offline, or none. */
  state: DataState;
  retry: () => void;
}

/**
 * The notification a detail screen shows, read LIVE so a later server answer —
 * the stack it names, its read state — reaches the open screen. The row is read
 * by id, which the query fills when the device did not hold it.
 */
export function useNotificationDetail(id: string): NotificationDetail {
  const expirationLink = useNotificationStore(
    state => state.pendingExpirationLinks[id],
  );
  const { data, loading, error, refetch } = useQuery(
    NotificationDetailDocument,
    { variables: { id }, fetchPolicy: 'cache-first' },
  );
  const { data: row, complete } = useFragment({
    fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
    fragmentName: 'useNotificationsOnLaunch_notification',
    from: { __typename: 'Notification', id },
  });
  const notification = complete
    ? toDisplayNotification(row, expirationLink)
    : undefined;
  const state = useDataState({
    loading,
    error,
    hasResult: data !== undefined,
    isEmpty: !notification,
  });
  return {
    notification,
    state,
    retry: () => {
      void refetch();
    },
  };
}
