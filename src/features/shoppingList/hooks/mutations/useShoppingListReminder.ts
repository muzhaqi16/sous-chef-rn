/**
 * useShoppingListReminder — set / clear a shopping-list reminder.
 *
 * Online-only: both mutations return the updated list, which Apollo normalizes
 * by `__typename + id`, so no cache write of our own is needed. `isApiUnavailable`
 * is returned so the screen can disable the affordance before it is tapped.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  UpdateShoppingListReminderDocument,
  DeleteShoppingListReminderDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function useShoppingListReminder() {
  const { t } = useTranslation();
  const [setMutation, { loading: setting }] = useMutation(
    UpdateShoppingListReminderDocument,
  );
  const [clearMutation, { loading: clearing }] = useMutation(
    DeleteShoppingListReminderDocument,
  );

  const isApiUnavailable = useIsApiUnavailable();

  const setReminder = async (
    id: string,
    reminderDate: string,
    reminderEnabled = true,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await setMutation({
        variables: { input: { id, reminderDate, reminderEnabled } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Set Reminder error:',
      });
    }

    if (!result) return false;
    if (alertIfRejected(result, t('shoppingListScreens.failedToSetReminder'))) {
      return false;
    }
    return true;
  };

  const clearReminder = async (id: string): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await clearMutation({
        variables: { input: { id } },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Clear Reminder error:',
      });
    }

    if (!result) return false;
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToClearReminder'))
    ) {
      return false;
    }
    return true;
  };

  return { setReminder, clearReminder, setting, clearing, isApiUnavailable };
}
