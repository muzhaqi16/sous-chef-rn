/**
 * Local-first: the reminder fields are absolute sets keyed by the list id, written
 * to the cache before firing and idempotent on a queued replay. A failure restores
 * the pre-change snapshot and alerts.
 */

import { useTranslation } from '#i18n';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const set = useLocalWrite(UpdateShoppingListReminderDocument, {
    fallback: t('shoppingListScreens.failedToSetReminder'),
  });
  const clear = useLocalWrite(DeleteShoppingListReminderDocument, {
    fallback: t('shoppingListScreens.failedToClearReminder'),
  });

  const setReminder = async (
    id: string,
    reminderDate: string,
    reminderEnabled = true,
  ): Promise<boolean> => {
    const settled = await set.sendFields({
      entity: { __typename: 'ShoppingList', id },
      fields: { reminderEnabled, reminderDate },
      variables: { input: { id, reminderDate, reminderEnabled } },
    });
    return settled.status !== 'failed';
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    const settled = await clear.sendFields({
      entity: { __typename: 'ShoppingList', id },
      fields: { reminderEnabled: false, reminderDate: null },
      variables: { input: { id } },
    });
    return settled.status !== 'failed';
  };

  return { setReminder, clearReminder };
}
