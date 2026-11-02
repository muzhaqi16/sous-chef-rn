/**
 * Local-first: the reminder fields are absolute sets keyed by the list id, written
 * to the cache before firing and idempotent on a queued replay. A failure restores
 * the pre-change snapshot and alerts.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { sendFields } from '#/apollo/pendingWrites/sendFields';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [setMutation] = useMutation(UpdateShoppingListReminderDocument, {
    context: { localFirst: true },
  });
  const [clearMutation] = useMutation(DeleteShoppingListReminderDocument, {
    context: { localFirst: true },
  });

  const setReminder = async (
    id: string,
    reminderDate: string,
    reminderEnabled = true,
  ): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'ShoppingList', id },
      fields: { reminderEnabled, reminderDate },
      variables: { input: { id, reminderDate, reminderEnabled } },
      mutate: setMutation,
      settle: {
        document: UpdateShoppingListReminderDocument,
        fallback: t('shoppingListScreens.failedToSetReminder'),
      },
    });
    return settled.status !== 'failed';
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'ShoppingList', id },
      fields: { reminderEnabled: false, reminderDate: null },
      variables: { input: { id } },
      mutate: clearMutation,
      settle: {
        document: DeleteShoppingListReminderDocument,
        fallback: t('shoppingListScreens.failedToClearReminder'),
      },
    });
    return settled.status !== 'failed';
  };

  return { setReminder, clearReminder };
}
