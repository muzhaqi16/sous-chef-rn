/**
 * Server-synced actions for expiration notifications. Same shape as
 * `useNotificationSync`: optimistic Zustand write, then the mutation under
 * `context: { localFirst: true }` so an offline action queues and replays
 * (idempotent server-side). Rolled back on a failure, never while queued.
 */

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  MarkExpirationActionDocument,
  MarkExpirationNotificationAsReadDocument,
} from '#features/notifications/graphql/expirationNotificationMutations.generated';
import type { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import {
  applyNotificationRead,
  applyNotificationUnread,
} from '#features/notifications/utils/notificationCacheWrites';
import { toastService } from '#/services/toastService';

export function useExpirationNotificationSync() {
  const client = useApolloClient();
  const { t } = useTranslation();
  const [markActionMutation] = useMutation(MarkExpirationActionDocument, {
    context: { localFirst: true },
  });
  // The server merged the former dismiss mutation into
  // markExpirationNotificationAsRead — marking read IS the dismissal.
  const [markReadMutation] = useMutation(
    MarkExpirationNotificationAsReadDocument,
    { context: { localFirst: true } },
  );

  const syncMarkAction = async (
    notificationId: string,
    expirationNotificationId: string,
    action: ExpirationAction,
  ) => {
    // The action is client-side enrichment and stays in the store; the row's
    // read-state is server state and goes to the cache.
    useNotificationStore.getState().setExpirationAction(notificationId, action);
    const markedRead = applyNotificationRead(client.cache, notificationId);

    toastService.success(t(`expirationAction.toast.${action}`));

    const revertAction = () => {
      useNotificationStore.getState().setExpirationAction(notificationId, '');
      if (markedRead) applyNotificationUnread(client.cache, notificationId);
    };

    await settleMutation(
      () =>
        markActionMutation({
          variables: {
            input: { notificationId: expirationNotificationId, action },
          },
        }),
      {
        document: MarkExpirationActionDocument,
        fallback: t('notifications.actionFailed'),
        onFailed: revertAction,
      },
    );
  };

  const syncMarkRead = async (expirationNotificationId: string) => {
    await settleMutation(
      () =>
        markReadMutation({
          variables: { input: { notificationId: expirationNotificationId } },
        }),
      {
        document: MarkExpirationNotificationAsReadDocument,
        fallback: t('notifications.actionFailed'),
        // Fired beside `syncMarkAction`, whose failure is the one shown.
        present: 'none',
      },
    );
  };

  return { syncMarkAction, syncMarkRead };
}
