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
import {
  UseShoppingListReminder_ListFragmentDoc,
  type UseShoppingListReminder_ListFragment,
} from './useShoppingListReminder.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [setMutation] = useMutation(UpdateShoppingListReminderDocument);
  const [clearMutation] = useMutation(DeleteShoppingListReminderDocument);

  const applyOptimistic = (
    id: string,
    patch: Partial<UseShoppingListReminder_ListFragment>,
    label: string,
  ): (() => void) =>
    applyOptimisticFragmentPatch(
      client.cache,
      { typename: 'ShoppingList', id },
      {
        fragment: UseShoppingListReminder_ListFragmentDoc,
        fragmentName: 'useShoppingListReminder_list',
      },
      patch,
      label,
    );

  const setReminder = async (
    id: string,
    reminderDate: string,
    reminderEnabled = true,
  ): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      { reminderEnabled, reminderDate },
      'Set Reminder',
    );

    const settled = await settleMutation(
      () =>
        setMutation({
          variables: { input: { id, reminderDate, reminderEnabled } },
          context: { localFirst: true },
        }),
      {
        document: UpdateShoppingListReminderDocument,
        fallback: t('shoppingListScreens.failedToSetReminder'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      { reminderEnabled: false, reminderDate: null },
      'Clear Reminder',
    );

    const settled = await settleMutation(
      () =>
        clearMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: DeleteShoppingListReminderDocument,
        fallback: t('shoppingListScreens.failedToClearReminder'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  return { setReminder, clearReminder };
}
