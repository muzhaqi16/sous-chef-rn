import { useFragment } from '@apollo/client/react';
import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { UseNotificationsOnLaunch_NotificationFragmentDoc } from './useNotificationsOnLaunch.generated';
import {
  toDisplayNotification,
  type DisplayNotification,
} from '#features/notifications/utils/toDisplayNotification';

/**
 * The notification a detail screen shows, read LIVE so a later server answer —
 * the stack it names, its read state — reaches the open screen. The snapshot it
 * was opened with stands in while the cache holds no complete row.
 */
export function useNotificationDetail(
  id: string,
  snapshot: DisplayNotification | undefined,
): DisplayNotification | undefined {
  const expirationLink = useNotificationStore(
    state => state.pendingExpirationLinks[id],
  );
  const { data, complete } = useFragment({
    fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
    fragmentName: 'useNotificationsOnLaunch_notification',
    from: id ? { __typename: 'Notification', id } : null,
  });
  return complete ? toDisplayNotification(data, expirationLink) : snapshot;
}
