/**
 * useShoppingListBudget — set a list's budget limit and toggle price tracking
 * (local-first).
 *
 * Both ride on updateShoppingList (budget → the `planning` sub-input, price
 * tracking → the `settings` sub-input) — absolute sets keyed by the list id, so
 * we write to the cache before firing and a queued replay re-applies the same
 * state idempotently. A rejection restores the pre-change snapshot and alerts.
 * totalCost / estimatedTotal are server-derived and reconcile from the response;
 * they're never written optimistically.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from 'react-i18next';
import { UpdateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseShoppingListBudget_ListFragmentDoc,
  type UseShoppingListBudget_ListFragment,
} from './useShoppingListBudget.generated';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import type { UpdateShoppingListInput } from '#/graphql/generated/schemaTypes';

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
    input: Omit<UpdateShoppingListInput, 'id'>,
    revert: () => void,
    failureMessage: string,
  ): Promise<boolean> => {
    const result = await executeMutation(
      () =>
        mutate({
          variables: { input: { id, ...input } },
          context: { localFirst: true },
        }),
      'Update Shopping List budget error:',
    );

    if (!result) {
      revert();
      return false;
    }
    if (
      alertIfRejected(
        result,
        'updateShoppingList',
        'UpdateShoppingListPayload',
        failureMessage,
      )
    ) {
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
