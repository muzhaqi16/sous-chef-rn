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
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkExpirationActionDocument,
  MarkExpirationNotificationAsReadDocument,
} from '#features/notifications/graphql/expirationNotificationMutations.generated';
import { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import {
  applyNotificationRead,
  applyNotificationUnread,
} from '#features/notifications/utils/notificationCacheWrites';
import { errorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';

export function useExpirationNotificationSync() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [markActionMutation] = useMutation(MarkExpirationActionDocument);
  // The server merged the former dismiss mutation into
  // markExpirationNotificationAsRead — marking read IS the dismissal.
  const [markReadMutation] = useMutation(
    MarkExpirationNotificationAsReadDocument,
  );

  const syncMarkAction = async (
    notificationId: string,
    expirationNotificationId: string,
    action: ExpirationAction,
  ) => {
    // The action is client-side enrichment and stays in the store; the row's
    // read-state is server state and goes to the cache.
    useStore.getState().setExpirationAction(notificationId, action);
    const markedRead = applyNotificationRead(
      client.cache,
      useStore.getState().user?.id,
      notificationId,
    );

    toastService.success(t(`expirationAction.toast.${action}`));

    let result;
    try {
      result = await markActionMutation({
        variables: {
          input: { notificationId: expirationNotificationId, action },
        },
        context: { localFirst: true },
      });
    } catch (error: unknown) {
      // Only a link-level throw lands here; a refusal resolves (errorPolicy
      // 'all'), which is why the rollback below reads the RESULT.
      errorService.reportError(error, {
        operation: 'syncMarkExpirationAction',
        notificationId: expirationNotificationId,
        action,
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      useStore.getState().setExpirationAction(notificationId, '');
      if (markedRead) {
        applyNotificationUnread(
          client.cache,
          useStore.getState().user?.id,
          notificationId,
        );
      }
    }
  };

  const syncMarkRead = async (expirationNotificationId: string) => {
    try {
      await markReadMutation({
        variables: { input: { notificationId: expirationNotificationId } },
        context: { localFirst: true },
      });
    } catch (error: unknown) {
      errorService.reportError(error, {
        operation: 'syncMarkExpirationRead',
        notificationId: expirationNotificationId,
      });
    }
  };

  return { syncMarkAction, syncMarkRead };
}
