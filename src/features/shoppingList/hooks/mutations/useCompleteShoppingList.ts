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
import {
  snapshotFields,
  writeEntityFields,
} from '#/apollo/utils/localFirstFields';

export function useCompleteShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();
  const [completeMutation, { loading: completing }] = useMutation(
    CompleteShoppingListDocument,
    { context: { localFirst: true } },
  );
  const [reactivateMutation, { loading: reactivating }] = useMutation(
    MarkShoppingListActiveDocument,
    { context: { localFirst: true } },
  );

  /** Writes `patch` over the list and returns what restores the held values. */
  const applyOptimistic = (
    id: string,
    patch: Partial<UseCompleteShoppingList_ListFragment>,
  ): (() => void) => {
    const entity = { __typename: 'ShoppingList', id };
    const held =
      client.cache.readFragment<UseCompleteShoppingList_ListFragment>({
        id: client.cache.identify(entity),
        fragment: UseCompleteShoppingList_ListFragmentDoc,
        fragmentName: 'useCompleteShoppingList_list',
        returnPartialData: true,
      });
    const previous = snapshotFields(held, patch);
    writeEntityFields(client.cache, entity, patch);
    return () => writeEntityFields(client.cache, entity, previous);
  };

  const completeList = async (
    id: string,
    totalCost?: number,
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const revert = applyOptimistic(id, {
      status: ListStatus.Completed,
      isCompleted: true,
      completedShopDate: now,
    });

    const input = {
      id,
      completedShopDate: now,
      ...(totalCost !== undefined && { totalCost }),
    };
    const settled = await settleMutation(
      () =>
        completeMutation({
          variables: { input },
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
    const revert = applyOptimistic(id, {
      status: ListStatus.Active,
      isCompleted: false,
      completedShopDate: null,
    });

    const settled = await settleMutation(
      () =>
        reactivateMutation({
          variables: { input: { id } },
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
