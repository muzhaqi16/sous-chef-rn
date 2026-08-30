/**
 * Local-first: budget rides on updateShoppingList's `planning` sub-input and price
 * tracking on `settings` — absolute sets keyed by the list id, written to the cache
 * before firing and idempotent on a queued replay. totalCost / estimatedTotal are
 * server-derived and are never written optimistically.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListBudget_ListFragmentDoc,
  type UseShoppingListBudget_ListFragment,
} from './useShoppingListBudget.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { toastService } from '#/services/toastService';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import type { UpdateShoppingListInput } from '#/graphql/generated/schemaTypes';
import { errorService } from '#/services/errorService';

export function useShoppingListBudget() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [mutate, { loading }] = useMutation(UpdateShoppingListDocument);

  const applyOptimistic = (
    id: string,
    patch: Partial<UseShoppingListBudget_ListFragment>,
    label: string,
  ): (() => void) =>
    applyOptimisticFragmentPatch(
      client.cache,
      { typename: 'ShoppingList', id },
      {
        fragment: UseShoppingListBudget_ListFragmentDoc,
        fragmentName: 'useShoppingListBudget_list',
      },
      patch,
      label,
    );

  const runUpdate = async (
    id: string,
    input: Omit<UpdateShoppingListInput, 'id' | 'version'>,
    revert: () => void,
    failureMessage: string,
  ): Promise<boolean> => {
    // The server requires the version: an update sent without one reports
    // success while overwriting a concurrent edit.
    const current =
      client.cache.readFragment<UseShoppingListBudget_ListFragment>({
        id: client.cache.identify({ __typename: 'ShoppingList', id }),
        fragment: UseShoppingListBudget_ListFragmentDoc,
        fragmentName: 'useShoppingListBudget_list',
      });
    if (!current) {
      revert();
      toastService.error(failureMessage);
      return false;
    }

    let result;
    try {
      result = await mutate({
        variables: { input: { id, ...input, version: current.version } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Update Shopping List budget error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (alertIfRejected(result, failureMessage)) {
      revert();
      return false;
    }
    return true;
  };

  const setBudget = async (
    id: string,
    budgetAmount: number | null,
    currency?: string | null,
  ): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      { budgetAmount, ...(currency !== undefined && { currency }) },
      'Set Budget',
    );
    return runUpdate(
      id,
      {
        planning: { budgetAmount, ...(currency !== undefined && { currency }) },
      },
      revert,
      t('shoppingListScreens.failedToSetBudget'),
    );
  };

  const setPriceTracking = async (
    id: string,
    priceTracking: boolean,
  ): Promise<boolean> => {
    const revert = applyOptimistic(id, { priceTracking }, 'Set Price Tracking');
    return runUpdate(
      id,
      { settings: { priceTracking } },
      revert,
      t('shoppingListScreens.failedToSetPriceTracking'),
    );
  };

  return { setBudget, setPriceTracking, loading };
}
