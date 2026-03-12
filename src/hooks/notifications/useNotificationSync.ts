/**
 * useNotificationSync Hook
 *
 * Provides server-synced notification actions (mark read, mark unread, delete).
 * Each action performs an optimistic local update via Zustand, then fires the
 * corresponding GraphQL mutation to persist on the server.
 *
 * On mutation failure:
 * - All errors are reported to errorService for production telemetry.
 * - Network errors keep the optimistic UI (transient, subscription will reconcile).
 * - Server errors roll back the optimistic local state to prevent permanent desync.
 *
 * Uses executeMutation from compilerSafeWrappers to avoid try-catch in the hook body.
 */

import {
  useMarkNotificationAsReadMutation,
  useMarkNotificationUnreadMutation,
  useDeleteNotificationMutation,
} from '#generated';
import { useStore } from '#store';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';

export function useNotificationSync() {
  const [markReadMutation] = useMarkNotificationAsReadMutation();
  const [markUnreadMutation] = useMarkNotificationUnreadMutation();
  const [deleteMutation] = useDeleteNotificationMutation();

  const syncMarkAsRead = (id: string) => {
    // Skip if already read
    const notification = useStore
      .getState()
      .notifications.find(n => n.id === id);
    if (!notification || notification.isRead) return;

    // Optimistic local update
    useStore.getState().markAsRead(id);

    executeMutation(
      () => markReadMutation({ variables: { id } }),
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
      () => markUnreadMutation({ variables: { id } }),
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
      () => deleteMutation({ variables: { id } }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncDeleteNotification',
          notificationId: id,
        });
        if (!isNetworkError(error) && snapshot) {
          useStore.getState().restoreNotification(snapshot);
        }
      },
    );
  };

  const syncMarkAllAsRead = () => {
    const unreadIds = useStore
      .getState()
      .notifications.filter(n => !n.isRead)
      .map(n => n.id);

    if (unreadIds.length === 0) return;

    // Optimistic local update
    useStore.getState().markAllAsRead();

    // Sync each to server — each mutation has its own error handler
    // so only the failed ones get rolled back
    for (const id of unreadIds) {
      executeMutation(
        () => markReadMutation({ variables: { id } }),
        (error: unknown) => {
          errorService.reportError(error, {
            operation: 'syncMarkAllAsRead',
            notificationId: id,
          });
          if (!isNetworkError(error)) {
            useStore.getState().markAsUnread(id);
          }
        },
      );
    }
  };

  return {
    syncMarkAsRead,
    syncMarkUnread,
    syncDelete,
    syncMarkAllAsRead,
  };
}
