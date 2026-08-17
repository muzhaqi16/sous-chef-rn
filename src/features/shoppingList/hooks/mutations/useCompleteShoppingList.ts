/**
 * useCompleteShoppingList — mark a shopping list complete / reactivate it
 * (local-first).
 *
 * Finishing a shopping trip is exactly the moment you're likely offline (at the
 * store, no signal), so both directions write the new status to the cache
 * PERMANENTLY before firing and queue the canonical mutation. The status is an
 * absolute set keyed by the list id, so a queued replay re-applies the same
 * state idempotently. A real rejection restores the pre-change snapshot and
 * surfaces an alert (there's no mutation onError, so alertIfRejected is the sole
 * alerter — it also covers a resolved transport error under errorPolicy 'all').
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

  // Permanent write BEFORE firing (survives an offline/API-down queue where no
  // response ever arrives), returning a revert that restores the snapshot.
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
      // the feedback; executeMutation already logged the error.
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
