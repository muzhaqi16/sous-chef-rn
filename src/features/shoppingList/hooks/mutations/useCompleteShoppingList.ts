/**
 * Local-first: the new status is written to the cache PERMANENTLY before firing —
 * an absolute set keyed by the list id, so a queued replay re-applies it
 * idempotently. There is no mutation `onError`, so `alertIfRejected` is the sole
 * alerter; under `errorPolicy: 'all'` a refusal resolves as data and never throws.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { useTranslation } from '#/i18n';
import {
  CompleteShoppingListDocument,
  MarkShoppingListActiveDocument,
} from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseCompleteShoppingList_ListFragmentDoc,
  type UseCompleteShoppingList_ListFragment,
} from './useCompleteShoppingList.generated';
import { ListStatus } from '#/graphql/generated/schemaTypes';
import { alertIfRejected } from '#/apollo/utils/alertRejectedMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';
import { errorService } from '#/services/errorService';

export function useCompleteShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [completeMutation, { loading: completing }] = useMutation(
    CompleteShoppingListDocument,
  );
  const [reactivateMutation, { loading: reactivating }] = useMutation(
    MarkShoppingListActiveDocument,
  );

  const applyOptimistic = (
    id: string,
    patch: Partial<UseCompleteShoppingList_ListFragment>,
    label: string,
  ): (() => void) =>
    applyOptimisticFragmentPatch(
      client.cache,
      { typename: 'ShoppingList', id },
      {
        fragment: UseCompleteShoppingList_ListFragmentDoc,
        fragmentName: 'useCompleteShoppingList_list',
      },
      patch,
      label,
    );

  const completeList = async (
    id: string,
    totalCost?: number,
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const revert = applyOptimistic(
      id,
      {
        status: ListStatus.Completed,
        isCompleted: true,
        completedShopDate: now,
      },
      'Complete Shopping List',
    );

    let result;
    const completeMutationOptions = {
      variables: {
        input: {
          id,
          completedShopDate: now,
          ...(totalCost !== undefined && { totalCost }),
        },
      },
      context: { localFirst: true },
    };
    try {
      result = await completeMutation(completeMutationOptions);
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Complete Shopping List error:',
      });
    }

    if (!result) {
      // mutate() threw (non-queueable transport failure) — the visible revert is
      // the feedback; the error is already logged.
      revert();
      return false;
    }
    if (alertIfRejected(result, t('shoppingListScreens.failedToComplete'))) {
      revert();
      return false;
    }
    // created (server) or queued (offline) — keep the optimistic write.
    return true;
  };

  const reactivateList = async (id: string): Promise<boolean> => {
    const revert = applyOptimistic(
      id,
      {
        status: ListStatus.Active,
        isCompleted: false,
        completedShopDate: null,
      },
      'Reactivate Shopping List',
    );

    let result;
    try {
      result = await reactivateMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Reactivate Shopping List error:',
      });
    }

    if (!result) {
      revert();
      return false;
    }
    if (alertIfRejected(result, t('shoppingListScreens.failedToReactivate'))) {
      revert();
      return false;
    }
    return true;
  };

  return { completeList, reactivateList, completing, reactivating };
}
