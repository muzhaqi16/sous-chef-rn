/**
 * Local-first: the reminder fields are absolute sets keyed by the list id, written
 * to the cache before firing and idempotent on a queued replay. A failure restores
 * the pre-change snapshot and alerts.
 */

import { useTranslation } from '#i18n';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import {
  deleteShoppingListReminderWrite,
  updateShoppingListReminderWrite,
} from '#features/shoppingList/offline/localWrites';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const set = useLocalWrite(updateShoppingListReminderWrite, {
    fallback: t('shoppingListScreens.failedToSetReminder'),
  });
  const clear = useLocalWrite(deleteShoppingListReminderWrite, {
    fallback: t('shoppingListScreens.failedToClearReminder'),
  });

  const setReminder = async (
    id: string,
    reminderDate: string,
    reminderEnabled = true,
  ): Promise<boolean> => {
    const settled = await set.send(
      { input: { id, reminderDate, reminderEnabled } },
      {
        entity: { __typename: 'ShoppingList', id },
        fields: { reminderEnabled, reminderDate },
      },
    );
    return settled.status !== 'failed';
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    const settled = await clear.send(
      { input: { id } },
      {
        entity: { __typename: 'ShoppingList', id },
        fields: { reminderEnabled: false, reminderDate: null },
      },
    );
    return settled.status !== 'failed';
  };

  return { setReminder, clearReminder };
}
