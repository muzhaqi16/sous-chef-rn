/**
 * useNotificationSync Hook
 *
 * Provides server-synced notification actions (mark read, mark unread, delete).
 * Each action performs an optimistic local update via Zustand, then fires the
 * corresponding GraphQL mutation to persist on the server.
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

export function useNotificationSync() {
  const [markReadMutation] = useMarkNotificationAsReadMutation();
  const [markUnreadMutation] = useMarkNotificationUnreadMutation();
  const [deleteMutation] = useDeleteNotificationMutation();

  const syncMarkAsRead = (id: string) => {
    // Optimistic local update
    useStore.getState().markAsRead(id);

    // Fire-and-forget server sync — local state is already updated
    executeMutation(
      () => markReadMutation({ variables: { id } }),
      'Failed to sync markNotificationAsRead:',
    );
  };

  const syncMarkUnread = (id: string) => {
    // No local "markUnread" action exists yet — fire mutation only
    executeMutation(
      () => markUnreadMutation({ variables: { id } }),
      'Failed to sync markNotificationUnread:',
    );
  };

  const syncDelete = (id: string) => {
    // Optimistic local removal
    useStore.getState().removeNotification(id);

    // Fire-and-forget server sync
    executeMutation(
      () => deleteMutation({ variables: { id } }),
      'Failed to sync deleteNotification:',
    );
  };

  const syncMarkAllAsRead = () => {
    const notifications = useStore.getState().notifications;
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);

    // Optimistic local update
    useStore.getState().markAllAsRead();

    // Sync each to server — fire-and-forget
    for (const id of unreadIds) {
      executeMutation(
        () => markReadMutation({ variables: { id } }),
        'Failed to sync markNotificationAsRead:',
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
