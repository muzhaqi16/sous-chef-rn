/**
 * Server-synced notification actions: mark read / unread, delete, mark all
 * read, clear read, send test.
 *
 * Each action writes the Apollo cache first so the UI moves immediately, then
 * fires the mutation. The notification and the unread badge move in the SAME
 * direction at the SAME time, because they are one fact read two ways — the
 * feed's `status` and `User.unreadNotificationCount`. A revert puts both back.
 *
 * Mutations carry `context: { localFirst: true }` so an offline action is
 * queued and replayed rather than lost; these are idempotent server-side
 * (marking an already-read notification is a no-op), so replay is safe.
 *
 * **Failure is read off the RESOLVED result, not a `catch`.** The client sets
 * `mutate: { errorPolicy: 'all' }`, and Apollo's `QueryManager.mutate` then
 * `resolve({ data: undefined, error })` instead of rejecting — so a `catch`
 * only ever sees a link-level throw. The previous version put every rollback in
 * a `catch`, which meant a server refusal left the optimistic write standing
 * permanently. `classifyCreateResult` reads the three outcomes off the result:
 *
 *  - `'rejected'` — the server refused it. Revert.
 *  - `'queued'`   — offline; the queue replays it later. Keep the write.
 *                   (A queued result is `data` with the payload field set to
 *                   `null`, NOT absent data — checking `!result.data` would
 *                   classify it as a refusal and revert a write that is about
 *                   to succeed.)
 *  - `'created'`  — confirmed. Keep, and let normalization write the server's
 *                   own `status` through.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import {
  MarkNotificationAsReadDocument,
  MarkNotificationUnreadDocument,
  DeleteNotificationDocument,
  SendTestNotificationDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import {
  MarkAllNotificationsAsReadDocument,
  DeleteMultipleNotificationsDocument,
} from '#features/notifications/graphql/bulkNotificationMutations.generated';
import { NotificationType } from '#/graphql/generated/schemaTypes';
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
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { useStore } from '#store';
import { errorService } from '#/services/errorService';

export function useNotificationSync() {
  const client = useApolloClient();
  const [markReadMutation] = useMutation(MarkNotificationAsReadDocument);
  const [markUnreadMutation] = useMutation(MarkNotificationUnreadDocument);
  const [deleteMutation] = useMutation(DeleteNotificationDocument);
  const [markAllReadMutation] = useMutation(MarkAllNotificationsAsReadDocument);
  const [deleteMultipleMutation] = useMutation(
    DeleteMultipleNotificationsDocument,
  );
  const [sendTestMutation] = useMutation(SendTestNotificationDocument);

  const userId = () => useStore.getState().user?.id;

  const syncMarkAsRead = async (id: string) => {
    const cache = client.cache;
    // Optimistic: the row and the badge move together, or neither does.
    if (!applyNotificationRead(cache, userId(), id)) return;

    let result;
    try {
      result = await markReadMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error: unknown) {
      // Only a link-level throw reaches here; the ordinary refusal path is the
      // resolved result below.
      errorService.reportError(error, {
        operation: 'syncMarkAsRead',
        notificationId: id,
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      applyNotificationUnread(cache, userId(), id);
    }
  };

  const syncMarkUnread = async (id: string) => {
    const cache = client.cache;
    if (!applyNotificationUnread(cache, userId(), id)) return;

    let result;
    try {
      result = await markUnreadMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error: unknown) {
      errorService.reportError(error, {
        operation: 'syncMarkUnread',
        notificationId: id,
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      applyNotificationRead(cache, userId(), id);
    }
  };

  const syncDelete = async (id: string) => {
    const cache = client.cache;
    // Read the row before evicting it; a refusal writes it back.
    const restore = captureNotification(cache, id);
    if (!applyNotificationRemoved(cache, userId(), id)) return;

    let result;
    try {
      result = await deleteMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error: unknown) {
      errorService.reportError(error, {
        operation: 'syncDeleteNotification',
        notificationId: id,
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      restoreNotifications(cache, userId(), restore ? [restore] : []);
    } else {
      // The row is gone for good; drop its client-side enrichment with it.
      useStore.getState().clearExpirationLink(id);
    }
  };

  const syncMarkAllAsRead = async () => {
    const cache = client.cache;

    // Returns the ids it flipped — a refusal marks exactly those unread again.
    const flipped = applyAllNotificationsRead(cache, userId());
    if (flipped.length === 0) return;

    let result;
    try {
      result = await markAllReadMutation({ context: { localFirst: true } });
    } catch (error: unknown) {
      errorService.reportError(error, { operation: 'syncMarkAllAsRead' });
    }

    if (classifyCreateResult(result) === 'rejected') {
      flipped.forEach(id => applyNotificationUnread(cache, userId(), id));
    }
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

    let result;
    try {
      result = await deleteMultipleMutation({
        variables: { input: { ids } },
        context: { localFirst: true },
      });
    } catch (error: unknown) {
      errorService.reportError(error, {
        operation: 'syncClearReadNotifications',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      restoreNotifications(cache, userId(), captured);
    } else {
      ids.forEach(id => useStore.getState().clearExpirationLink(id));
    }
  };

  /**
   * Fire a self-addressed test notification. The created notification arrives
   * back through the live subscription, so there is no optimistic write.
   */
  const syncSendTest = async (
    type: NotificationType = NotificationType.ExpiryReminder,
  ): Promise<boolean> => {
    let result;
    try {
      result = await sendTestMutation({ variables: { input: { type } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'syncSendTestNotification',
      });
    }
    return classifyCreateResult(result) !== 'rejected';
  };

  return {
    syncMarkAsRead,
    syncMarkUnread,
    syncDelete,
    syncMarkAllAsRead,
    syncClearRead,
    syncSendTest,
  };
}
