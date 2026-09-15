/**
 * Local-first: the new status is written to the cache PERMANENTLY before firing —
 * an absolute set keyed by the list id, so a queued replay re-applies it
 * idempotently. A failure reverts the write; a queued one keeps it.
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
import { settleMutation } from '#/apollo/utils/settleMutation';
import { applyOptimisticFragmentPatch } from '#/apollo/utils/cacheUpdaters';

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

    const input = {
      id,
      completedShopDate: now,
      ...(totalCost !== undefined && { totalCost }),
    };
    const settled = await settleMutation(
      () =>
        completeMutation({
          variables: { input },
          context: { localFirst: true },
        }),
      {
        document: CompleteShoppingListDocument,
        fallback: t('shoppingListScreens.failedToComplete'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
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

    const settled = await settleMutation(
      () =>
        reactivateMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        }),
      {
        document: MarkShoppingListActiveDocument,
        fallback: t('shoppingListScreens.failedToReactivate'),
        onFailed: revert,
      },
    );
    return settled.status !== 'failed';
  };

  return { completeList, reactivateList, completing, reactivating };
}
