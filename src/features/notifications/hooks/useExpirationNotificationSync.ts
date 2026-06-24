/**
 * useExpirationNotificationSync Hook
 *
 * Provides server-synced actions for expiration notifications:
 * - Mark an expiration action (CONSUMED, COOKED, SHARED, EXTENDED, WASTE, NO_ACTION)
 * - Dismiss an expiration notification
 * - Mark an expiration notification as read
 *
 * Mirrors useNotificationSync pattern: optimistic local update via Zustand,
 * then fire GraphQL mutation with `context: { localFirst: true }` so an offline
 * action is queued and replayed on reconnect (idempotent server-side) instead
 * of being lost. Rollback on server error (not network).
 *
 * Uses executeMutation from compilerSafeWrappers to avoid try-catch in the hook body.
 */

import { useMutation } from '@apollo/client/react';
import {
  MarkExpirationActionDocument,
  MarkExpirationNotificationDismissedDocument,
  MarkExpirationNotificationAsReadDocument,
} from '#features/notifications/graphql/expirationNotificationMutations.generated';
import { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { errorService } from '#/services/errorService';
import { isNetworkError } from '#/utils/isNetworkError';
import { toastService } from '#/services/toastService';

const ACTION_LABELS: Record<ExpirationAction, string> = {
  [ExpirationAction.Cooked]: 'Marked as cooked',
  [ExpirationAction.Consumed]: 'Marked as consumed',
  [ExpirationAction.Shared]: 'Marked as shared',
  [ExpirationAction.Extended]: 'Shelf life extended',
  [ExpirationAction.Waste]: 'Marked as wasted',
  [ExpirationAction.NoAction]: 'Dismissed',
};

export function useExpirationNotificationSync() {
  const [markActionMutation] = useMutation(MarkExpirationActionDocument);
  const [dismissMutation] = useMutation(
    MarkExpirationNotificationDismissedDocument,
  );
  const [markReadMutation] = useMutation(
    MarkExpirationNotificationAsReadDocument,
  );

  const syncMarkAction = (
    notificationId: string,
    expirationNotificationId: string,
    action: ExpirationAction,
  ) => {
    // Optimistic: update the notification in Zustand immediately
    useStore.getState().setExpirationAction(notificationId, action);
    // Also mark the generic notification as read
    useStore.getState().markAsRead(notificationId);

    toastService.success(ACTION_LABELS[action]);

    executeMutation(
      () =>
        markActionMutation({
          variables: {
            input: { notificationId: expirationNotificationId, action },
          },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncMarkExpirationAction',
          notificationId: expirationNotificationId,
          action,
        });
        // Rollback on server error
        if (!isNetworkError(error)) {
          useStore.getState().setExpirationAction(notificationId, '');
          useStore.getState().markAsUnread(notificationId);
        }
      },
    );
  };

  const syncDismiss = (expirationNotificationId: string) => {
    executeMutation(
      () =>
        dismissMutation({
          variables: { input: { notificationId: expirationNotificationId } },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncDismissExpiration',
          notificationId: expirationNotificationId,
        });
      },
    );
  };

  const syncMarkRead = (expirationNotificationId: string) => {
    executeMutation(
      () =>
        markReadMutation({
          variables: { input: { notificationId: expirationNotificationId } },
          context: { localFirst: true },
        }),
      (error: unknown) => {
        errorService.reportError(error, {
          operation: 'syncMarkExpirationRead',
          notificationId: expirationNotificationId,
        });
      },
    );
  };

  return { syncMarkAction, syncDismiss, syncMarkRead };
}
