/**
 * Local-first: the reminder fields are absolute sets keyed by the list id, written
 * to the cache before firing and idempotent on a queued replay. A rejection
 * restores the pre-change snapshot and alerts.
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
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import { errorService } from '#/services/errorService';

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

    let result;
    try {
      result = await setMutation({
        variables: { input: { id, reminderDate, reminderEnabled } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Set Reminder error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (alertIfRejected(result, t('shoppingListScreens.failedToSetReminder'))) {
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

    let result;
    try {
      result = await clearMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Clear Reminder error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToClearReminder'))
    ) {
      revert();
      return false;
    }
    return true;
  };

  return { setReminder, clearReminder, setting, clearing };
}
