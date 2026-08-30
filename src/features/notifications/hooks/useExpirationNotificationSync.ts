/**
 * Server-synced actions for expiration notifications. Same shape as
 * `useNotificationSync`: optimistic Zustand write, then the mutation under
 * `context: { localFirst: true }` so an offline action queues and replays
 * (idempotent server-side). Rolled back on a server error, not a network one.
 */

import { useNotificationStore } from '#features/notifications/store/notificationStore';
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
    useNotificationStore.getState().setExpirationAction(notificationId, action);
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
      useNotificationStore.getState().setExpirationAction(notificationId, '');
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
