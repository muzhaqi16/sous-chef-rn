/**
 * useRecurringShoppingList — turn a list's recurrence on/off and generate the
 * next occurrence.
 *
 * All three are ONLINE-ONLY: recurrence is list configuration set at home, and
 * generateNext creates a list whose id the server mints. Each refuses with a
 * localized toast while the API is unreachable; `isApiUnavailable` is returned
 * so the screen can disable the affordances up front.
 *
 * Apollo normalizes the recurrence fields from each mutation's own response, so
 * only generateNext needs an `update` — it adds the created list to the overview
 * connection (the same updater createShoppingList uses) and returns its id for
 * navigation.
 */

import { useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CreateRecurringShoppingListDocument,
  CancelRecurringDocument,
  GenerateNextRecurringListDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import { addShoppingListToQueryCache } from '#/apollo/utils/shoppingListCacheUpdaters';
import type { RecurringPattern } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { toastService } from '#/services/toastService';
import { errorService } from '#/services/errorService';

export function useRecurringShoppingList() {
  const { t } = useTranslation();
  const isApiUnavailable = useIsApiUnavailable();
  const [setupMutation, { loading: settingUp }] = useMutation(
    CreateRecurringShoppingListDocument,
  );
  const [cancelMutation, { loading: cancelling }] = useMutation(
    CancelRecurringDocument,
  );
  const [generateMutation, { loading: generating }] = useMutation(
    GenerateNextRecurringListDocument,
    {
      update(cache, { data }) {
        if (
          data?.generateNextRecurringList?.__typename ===
          'GenerateNextRecurringListPayload'
        ) {
          addShoppingListToQueryCache(
            cache,
            data.generateNextRecurringList.shoppingList,
          );
        }
      },
    },
  );

  const setRecurring = async (
    id: string,
    pattern: RecurringPattern,
    interval: number,
  ): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await setupMutation({
        variables: {
          input: {
            id,
            recurringPattern: pattern,
            recurringInterval: interval,
          },
        },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Set Recurring error:',
      });
    }

    if (!result) return false;
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToSetRecurring'))
    ) {
      return false;
    }
    return true;
  };

  const cancelRecurring = async (id: string): Promise<boolean> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await cancelMutation({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Cancel Recurring error:',
      });
    }

    if (!result) return false;
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToCancelRecurring'))
    ) {
      return false;
    }
    return true;
  };

  // Returns the created list's id (for navigation) or null on failure.
  const generateNext = async (id: string): Promise<string | null> => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return null;
    }

    let result;
    try {
      result = await generateMutation({ variables: { input: { id } } });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Generate Next Recurring List error:',
      });
    }

    if (!result) return null;
    if (
      alertIfRejected(result, t('shoppingListScreens.failedToGenerateNext'))
    ) {
      return null;
    }
    const payload = result.data?.generateNextRecurringList;
    return payload?.__typename === 'GenerateNextRecurringListPayload'
      ? payload.shoppingList.id
      : null;
  };

  return {
    setRecurring,
    cancelRecurring,
    generateNext,
    settingUp,
    cancelling,
    generating,
    isApiUnavailable,
  };
}
