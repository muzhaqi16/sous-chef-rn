/**
 * Server-synced notification actions. Each writes the cache first, then fires
 * under `context: { localFirst: true }` so an offline action queues and
 * replays (all are idempotent server-side). The notification and the badge are
 * one fact read two ways, so they move together and revert together. A payload
 * states `notificationSummary`, which settles the badge by normalization: no
 * delta follows a response.
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
    // Optimistic: the row and the badge move together, or neither does.
    if (!applyNotificationRead(cache, id)) return;

    const { failure } = await settleMutation(
      () =>
        markReadMutation({
          variables: { input: { id } },
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
      applyNotificationRemoved(cache, id);
      useNotificationStore.getState().clearExpirationLink(id);
      return;
    }
    applyNotificationUnread(cache, id);
    alertService.alert(failure.title, failure.body);
  };

  const syncDelete = async (id: string) => {
    const cache = client.cache;
    // Read the row before evicting it; a refusal writes it back.
    const restore = captureNotification(cache, id);
    if (!applyNotificationRemoved(cache, id)) return;

    const settled = await settleMutation(
      () =>
        deleteMutation({
          variables: { input: { id } },
        }),
      {
        document: DeleteNotificationDocument,
        fallback: t('notifications.deleteFailed'),
        removal: true,
        onFailed: () => restoreNotifications(cache, restore ? [restore] : []),
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
    const flipped = applyAllNotificationsRead(cache);
    if (flipped.length === 0) return;

    await settleMutation(() => markAllReadMutation(), {
      document: MarkAllNotificationsAsReadDocument,
      fallback: t('notifications.actionFailed'),
      onFailed: () => flipped.forEach(id => applyNotificationUnread(cache, id)),
    });
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
        }),
      {
        document: DeleteMultipleNotificationsDocument,
        fallback: t('notifications.deleteFailed'),
        removal: true,
        onFailed: () => restoreNotifications(cache, captured),
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
