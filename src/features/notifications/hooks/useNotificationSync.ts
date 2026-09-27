/**
 * Server-synced notification actions. Each writes the cache first, then fires
 * under `context: { localFirst: true }` so an offline action queues and
 * replays (all are idempotent server-side). The notification and the badge are
 * one fact read two ways, so they move together and revert together.
 */

// A failure reverts whether it threw or resolved as a refusal under
// `errorPolicy: 'all'`; a queued action keeps its write.

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
  applyAllNotificationsRead,
  applyNotificationRead,
  applyNotificationUnread,
  applyNotificationRemoved,
  evictNotification,
  captureNotification,
  restoreNotifications,
  type CapturedNotification,
} from '#features/notifications/utils/notificationCacheWrites';
import { isGoneCode, settleMutation } from '#/apollo/utils/settleMutation';
import { alertService } from '#/services/alertService';
import { useStore } from '#store';
import { useTranslation } from '#/i18n';

export function useNotificationSync() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [markReadMutation] = useMutation(MarkNotificationAsReadDocument);
  const [deleteMutation] = useMutation(DeleteNotificationDocument);
  const [markAllReadMutation] = useMutation(MarkAllNotificationsAsReadDocument);
  const [deleteMultipleMutation] = useMutation(
    DeleteMultipleNotificationsDocument,
  );

  const userId = () => useStore.getState().user?.id;

  const syncMarkAsRead = async (id: string) => {
    const cache = client.cache;
    // Optimistic: the row and the badge move together, or neither does.
    if (!applyNotificationRead(cache, userId(), id)) return;

    const { failure } = await settleMutation(
      () =>
        markReadMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: MarkNotificationAsReadDocument,
        fallback: t('notifications.actionFailed'),
        present: 'none',
      },
    );
    if (!failure) return;
    // Deleted on another device: already read here, so only the row goes.
    if (isGoneCode(failure.code)) {
      applyNotificationRemoved(cache, userId(), id);
      useNotificationStore.getState().clearExpirationLink(id);
      return;
    }
    applyNotificationUnread(cache, userId(), id);
    alertService.alert(failure.title, failure.body);
  };

  const syncDelete = async (id: string) => {
    const cache = client.cache;
    // Read the row before evicting it; a refusal writes it back.
    const restore = captureNotification(cache, id);
    if (!applyNotificationRemoved(cache, userId(), id)) return;

    const settled = await settleMutation(
      () =>
        deleteMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: DeleteNotificationDocument,
        fallback: t('notifications.deleteFailed'),
        removal: true,
        onFailed: () =>
          restoreNotifications(cache, userId(), restore ? [restore] : []),
      },
    );

    if (settled.status !== 'failed') {
      // The row is gone for good; drop its client-side enrichment with it.
      useNotificationStore.getState().clearExpirationLink(id);
    }
  };

  const syncMarkAllAsRead = async () => {
    const cache = client.cache;

    // Returns the ids it flipped — a refusal marks exactly those unread again.
    const flipped = applyAllNotificationsRead(cache, userId());
    if (flipped.length === 0) return;

    await settleMutation(
      () => markAllReadMutation({ context: { localFirst: true } }),
      {
        document: MarkAllNotificationsAsReadDocument,
        fallback: t('notifications.actionFailed'),
        onFailed: () =>
          flipped.forEach(id => applyNotificationUnread(cache, userId(), id)),
      },
    );
  };

  /**
   * "Clear read" — delete the already-read notifications, leaving unread ones.
   * Every removed notification is read, so the unread badge is untouched.
   */
  const syncClearRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    const cache = client.cache;
    // Capture before evicting; a refusal writes each row back.
    const captured = ids
      .map(id => captureNotification(cache, id))
      .filter((entry): entry is CapturedNotification => entry !== null);

    ids.forEach(id => evictNotification(cache, id, false));
    cache.gc();

    const settled = await settleMutation(
      () =>
        deleteMultipleMutation({
          variables: { input: { ids } },
          context: { localFirst: true },
        }),
      {
        document: DeleteMultipleNotificationsDocument,
        fallback: t('notifications.deleteFailed'),
        removal: true,
        onFailed: () => restoreNotifications(cache, userId(), captured),
      },
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
