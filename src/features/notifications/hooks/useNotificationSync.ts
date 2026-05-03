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

import { useMutation } from '@apollo/client/react';
import {
  MarkNotificationAsReadDocument,
  MarkNotificationUnreadDocument,
  DeleteNotificationDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import { MarkAllNotificationsAsReadDocument } from '#features/notifications/graphql/bulkNotificationMutations.generated';
import { useStore } from '#store';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';

export function useNotificationSync() {
  const [markReadMutation] = useMutation(MarkNotificationAsReadDocument);
  const [markUnreadMutation] = useMutation(MarkNotificationUnreadDocument);
  const [deleteMutation] = useMutation(DeleteNotificationDocument);
  const [markAllReadMutation] = useMutation(MarkAllNotificationsAsReadDocument);

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
      () => markAllReadMutation(),
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

  return {
    syncMarkAsRead,
    syncMarkUnread,
    syncDelete,
    syncMarkAllAsRead,
  };
}
