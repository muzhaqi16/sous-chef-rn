/**
 * Server-synced notification actions, each a pending layer under
 * `context: { localFirst: true }`, so an offline action queues and replays (all
 * are idempotent server-side). The notification and the badge are one fact read
 * two ways, so they move together and a refusal drops them together.
 */

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useApolloClient } from '@apollo/client/react';
import {
  applyNotificationRemoved,
  cachedUnreadNotificationIds,
  isUnreadStatus,
  readNotificationStatus,
} from '#features/notifications/utils/notificationCacheWrites';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { isGoneCode } from '#apollo/utils/settleMutation';
import { alertService } from '#services/alertService';
import { useTranslation } from '#i18n';
import {
  deleteMultipleNotificationsWrite,
  deleteNotificationWrite,
  markAllNotificationsAsReadWrite,
  markNotificationAsReadWrite,
} from '#features/notifications/offline/localWrites';

export function useNotificationSync() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const markRead = useLocalWrite(markNotificationAsReadWrite, {
    fallback: t('notifications.actionFailed'),
    present: 'none',
  });
  const remove = useLocalWrite(deleteNotificationWrite, {
    fallback: t('notifications.deleteFailed'),
    removal: true,
  });
  const markAllRead = useLocalWrite(markAllNotificationsAsReadWrite, {
    fallback: t('notifications.actionFailed'),
  });
  const removeMultiple = useLocalWrite(deleteMultipleNotificationsWrite, {
    fallback: t('notifications.deleteFailed'),
    removal: true,
  });

  const syncMarkAsRead = async (id: string) => {
    const cache = client.cache;
    // A push can open one the device does not hold yet; the answer states the
    // row and the badge, so only a row held as read is left alone.
    const status = readNotificationStatus(cache, id);
    if (status !== undefined && !isUnreadStatus(status)) return;

    const { failure } = await markRead.send({ input: { id } });
    if (!failure) return;
    // Deleted on another device: only the row is left to go.
    if (isGoneCode(failure.code)) {
      applyNotificationRemoved(cache, id);
      useNotificationStore.getState().clearExpirationLink(id);
      return;
    }
    alertService.alert(failure.title, failure.body);
  };

  const syncDelete = async (id: string) => {
    const settled = await remove.send({ input: { id } });

    if (settled.status !== 'failed') {
      // The row is gone for good; drop its client-side enrichment with it.
      useNotificationStore.getState().clearExpirationLink(id);
    }
  };

  const syncMarkAllAsRead = async () => {
    const cache = client.cache;
    if (cachedUnreadNotificationIds(cache).length === 0) return;

    await markAllRead.send({});
  };

  /**
   * "Clear read" — delete the already-read notifications, leaving unread ones.
   * Every removed notification is read, so the unread badge is untouched.
   */
  const syncClearRead = async (ids: string[]) => {
    if (ids.length === 0) return;

    const settled = await removeMultiple.send({ input: { ids } });

    if (settled.status !== 'failed') {
      ids.forEach(id =>
        useNotificationStore.getState().clearExpirationLink(id),
      );
    }
  };

  return {
    syncMarkAsRead,
    syncDelete,
    syncMarkAllAsRead,
    syncClearRead,
  };
}
