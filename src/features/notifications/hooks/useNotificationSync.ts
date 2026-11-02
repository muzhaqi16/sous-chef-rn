/**
 * Server-synced notification actions, each a pending layer under
 * `context: { localFirst: true }`, so an offline action queues and replays (all
 * are idempotent server-side). The notification and the badge are one fact read
 * two ways, so they move together and a refusal drops them together.
 */

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  MarkNotificationAsReadDocument,
  DeleteNotificationDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import {
  MarkAllNotificationsAsReadDocument,
  DeleteMultipleNotificationsDocument,
} from '#features/notifications/graphql/bulkNotificationMutations.generated';
import {
  applyNotificationRemoved,
  cachedUnreadNotificationIds,
  isUnreadStatus,
  readNotificationStatus,
} from '#features/notifications/utils/notificationCacheWrites';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { isGoneCode, settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';

export function useNotificationSync() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [markReadMutation] = useMutation(MarkNotificationAsReadDocument, {
    context: { localFirst: true },
  });
  const [deleteMutation] = useMutation(DeleteNotificationDocument, {
    context: { localFirst: true },
  });
  const [markAllReadMutation] = useMutation(
    MarkAllNotificationsAsReadDocument,
    { context: { localFirst: true } },
  );
  const [deleteMultipleMutation] = useMutation(
    DeleteMultipleNotificationsDocument,
    { context: { localFirst: true } },
  );

  const syncMarkAsRead = async (id: string) => {
    const cache = client.cache;
    if (!isUnreadStatus(readNotificationStatus(cache, id))) return;

    const { failure } = await pendingWritesOf(cache).send(
      MarkNotificationAsReadDocument,
      { input: { id } },
      write =>
        settleMutation(() => markReadMutation(write), {
          document: MarkNotificationAsReadDocument,
          fallback: t('notifications.actionFailed'),
          present: 'none',
        }),
    );
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
    const settled = await pendingWritesOf(client.cache).send(
      DeleteNotificationDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteMutation(write), {
          document: DeleteNotificationDocument,
          fallback: t('notifications.deleteFailed'),
          removal: true,
        }),
    );

    if (settled.status !== 'failed') {
      // The row is gone for good; drop its client-side enrichment with it.
      useNotificationStore.getState().clearExpirationLink(id);
    }
  };

  const syncMarkAllAsRead = async () => {
    const cache = client.cache;
    if (cachedUnreadNotificationIds(cache).length === 0) return;

    await pendingWritesOf(cache).send(
      MarkAllNotificationsAsReadDocument,
      {},
      write =>
        settleMutation(() => markAllReadMutation(write), {
          document: MarkAllNotificationsAsReadDocument,
          fallback: t('notifications.actionFailed'),
        }),
    );
  };

  /**
   * "Clear read" — delete the already-read notifications, leaving unread ones.
   * Every removed notification is read, so the unread badge is untouched.
   */
  const syncClearRead = async (ids: string[]) => {
    if (ids.length === 0) return;

    const settled = await pendingWritesOf(client.cache).send(
      DeleteMultipleNotificationsDocument,
      { input: { ids } },
      write =>
        settleMutation(() => deleteMultipleMutation(write), {
          document: DeleteMultipleNotificationsDocument,
          fallback: t('notifications.deleteFailed'),
          removal: true,
        }),
    );

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
