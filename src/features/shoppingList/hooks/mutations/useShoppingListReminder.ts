/**
 * useShoppingListReminder — set / clear a shopping-list reminder (local-first).
 *
 * The reminder fields are absolute sets keyed by the list id, so both directions
 * write to the cache before firing and a queued replay re-applies the same state
 * idempotently. A real rejection restores the pre-change snapshot and alerts.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListReminder_ListFragmentDoc,
  type UseShoppingListReminder_ListFragment,
} from './useShoppingListReminder.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import { executeMutation } from '#/utils/compilerSafeWrappers';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [setMutation, { loading: setting }] = useMutation(
    UpdateShoppingListReminderDocument,
  );
  const [clearMutation, { loading: clearing }] = useMutation(
    DeleteShoppingListReminderDocument,
  );

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

    const result = await executeMutation(
      () =>
        setMutation({
          variables: { input: { id, reminderDate, reminderEnabled } },
          context: { localFirst: true },
        }),
      'Set Reminder error:',
    );

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(
        result,
        'updateShoppingListReminder',
        'UpdateShoppingListReminderPayload',
        t('shoppingListScreens.failedToSetReminder'),
      )
    ) {
      revert();
      return false;
    }
    return true;
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      { reminderEnabled: false, reminderDate: null },
      'Clear Reminder',
    );

    const result = await executeMutation(
      () =>
        clearMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      'Clear Reminder error:',
    );

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(
        result,
        'deleteShoppingListReminder',
        'DeleteShoppingListReminderPayload',
        t('shoppingListScreens.failedToClearReminder'),
      )
    ) {
      revert();
      return false;
    }
    return true;
  };

  return { setReminder, clearReminder, setting, clearing };
}
