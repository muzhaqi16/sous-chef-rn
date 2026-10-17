/**
 * The server-synced action on an expiration notification, shaped as
 * `useNotificationSync`: a Zustand write, then a `localFirst` mutation that
 * queues offline. Rolled back on a failure, never while queued.
 */

import { useNotificationStore } from '#features/notifications/store/notificationStore';
import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { MarkExpirationActionDocument } from '#features/notifications/graphql/expirationNotificationMutations.generated';
import type { ExpirationAction } from '#/graphql/generated/schemaTypes';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { toastService } from '#/services/toastService';
import { todayKey } from '#/utils/dateUtils';

export function useExpirationNotificationSync() {
  const { t } = useTranslation();
  const [markActionMutation] = useMutation(MarkExpirationActionDocument, {
    context: { localFirst: true },
  });

  const syncMarkAction = async (
    notificationId: string,
    expirationNotificationId: string,
    action: ExpirationAction,
  ) => {
    // The action is client-side enrichment and stays in the store. The generic
    // row and the badge are not this mutation's: the service never moves them
    // here, and its payload states neither.
    useNotificationStore.getState().setExpirationAction(notificationId, action);

    toastService.success(t(`expirationAction.toast.${action}`));

    const revertAction = () => {
      useNotificationStore.getState().setExpirationAction(notificationId, '');
    };

    await settleMutation(
      () =>
        markActionMutation({
          variables: {
            input: { notificationId: expirationNotificationId, action },
            today: todayKey(),
          },
        }),
      {
        document: MarkExpirationActionDocument,
        fallback: t('notifications.actionFailed'),
        onFailed: revertAction,
      },
    );
  };

  return { syncMarkAction };
}
