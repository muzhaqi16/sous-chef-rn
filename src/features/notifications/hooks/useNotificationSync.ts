/**
 * useNotificationSync Hook
 *
 * Provides server-synced notification actions (mark read, mark unread, delete).
 * Each action performs an optimistic local update via Zustand, then fires the
 * corresponding GraphQL mutation to persist on the server.
 *
 * Each mutation is fired with `context: { localFirst: true }` so that while
 * offline it is queued and replayed on reconnect instead of being lost — these
 * operations are idempotent server-side (marking an already-read notification
 * is a no-op), so replay is safe. The notification entities live in Zustand, so
 * the optimistic UI is already applied locally before the mutation fires.
 *
 * On mutation failure:
 * - All errors are reported to errorService for production telemetry.
 * - Network errors keep the optimistic UI (the change is queued and replays).
 * - Server errors roll back the optimistic local state to prevent permanent desync.
 *
 * Uses executeMutation from compilerSafeWrappers to avoid try-catch in the hook body.
 */

import { useMutation } from '@apollo/client/react';
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
import { useStore } from '#store';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';

export function useNotificationSync() {
  const [markReadMutation] = useMutation(MarkNotificationAsReadDocument);
  const [markUnreadMutation] = useMutation(MarkNotificationUnreadDocument);
  const [deleteMutation] = useMutation(DeleteNotificationDocument);
  const [markAllReadMutation] = useMutation(MarkAllNotificationsAsReadDocument);
  const [deleteMultipleMutation] = useMutation(
    DeleteMultipleNotificationsDocument,
  );
  const [sendTestMutation] = useMutation(SendTestNotificationDocument);

  const syncMarkAsRead = (id: string) => {
    // Skip if already read
    const notification = useStore
      .getState()
      .notifications.find(n => n.id === id);
    if (!notification || notification.isRead) return;

    // Optimistic local update
    useStore.getState().markAsRead(id);

    executeMutation(
      () =>
        markReadMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncMarkAsRead',
          notificationId: id,
        });
        if (!isNetworkError(error)) {
          useStore.getState().markAsUnread(id);
        }
      },
    );
  };

  const syncMarkUnread = (id: string) => {
    executeMutation(
      () =>
        markUnreadMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncMarkUnread',
          notificationId: id,
        });
      },
    );
  };

  const syncDelete = (id: string) => {
    // Snapshot before removal for potential rollback
    const snapshot = useStore.getState().notifications.find(n => n.id === id);

    // Optimistic local removal
    useStore.getState().removeNotification(id);

    executeMutation(
      () =>
        deleteMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncDeleteNotification',
          notificationId: id,
        });
        if (!isNetworkError(error) && snapshot) {
          useStore.getState().addNotification(snapshot);
        }
      },
    );
  };

  const syncMarkAllAsRead = () => {
    const hasUnread = useStore.getState().notifications.some(n => !n.isRead);

    if (!hasUnread) return;

    // Optimistic local update
    useStore.getState().markAllAsRead();

    // Single bulk mutation instead of N individual calls
    executeMutation(
      () => markAllReadMutation({ context: { localFirst: true } }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncMarkAllAsRead',
        });
        // On server error, recalculate counts — cache-and-network will self-correct
        if (!isNetworkError(error)) {
          useStore.getState().updateUnreadCount();
        }
      },
    );
  };

  // Delete only the already-read notifications ("Clear read"), leaving unread
  // ones in place. Optimistically removes them locally, rolls back on a server
  // (non-network) error.
  const syncClearRead = () => {
    const readOnes = useStore.getState().notifications.filter(n => n.isRead);
    if (readOnes.length === 0) return;
    const ids = readOnes.map(n => n.id);

    ids.forEach(id => useStore.getState().removeNotification(id));

    executeMutation(
      () =>
        deleteMultipleMutation({
          variables: { input: { ids } },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncClearReadNotifications',
        });
        if (!isNetworkError(error)) {
          readOnes.forEach(n => useStore.getState().addNotification(n));
        }
      },
    );
  };

  // Fire a self-addressed test notification. The created notification arrives
  // back through the live subscription / next fetch, so there's no optimistic
  // local write here. Returns whether the request was accepted.
  const syncSendTest = async (
    type: NotificationType = NotificationType.ExpiryReminder,
  ): Promise<boolean> => {
    const result = await executeMutation(
      () => sendTestMutation({ variables: { input: { type } } }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncSendTestNotification',
        });
      },
    );
    return (
      !!result &&
      result.data?.sendTestNotification?.__typename ===
        'SendTestNotificationPayload'
    );
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
