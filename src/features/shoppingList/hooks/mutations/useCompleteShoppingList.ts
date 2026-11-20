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
import { ListStatus } from '#/graphql/generated/schemaTypes';
import { sendLocalWrite } from '#/apollo/pendingWrites/useLocalWrite';

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

  const completeList = async (
    id: string,
    totalCost?: number,
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const settled = await sendLocalWrite(
      client.cache,
      CompleteShoppingListDocument,
      {
        input: {
          id,
          completedShopDate: now,
          ...(totalCost !== undefined && { totalCost }),
        },
      },
      completeMutation,
      { fallback: t('shoppingListScreens.failedToComplete') },
      {
        entity: { __typename: 'ShoppingList', id },
        fields: {
          status: ListStatus.Completed,
          isCompleted: true,
          completedShopDate: now,
        },
      },
    );
    return settled.status !== 'failed';
  };

  const reactivateList = async (id: string): Promise<boolean> => {
    const settled = await sendLocalWrite(
      client.cache,
      MarkShoppingListActiveDocument,
      { input: { id } },
      reactivateMutation,
      { fallback: t('shoppingListScreens.failedToReactivate') },
      {
        entity: { __typename: 'ShoppingList', id },
        fields: {
          status: ListStatus.Active,
          isCompleted: false,
          completedShopDate: null,
        },
      },
    );
    return settled.status !== 'failed';
  };

  return { completeList, reactivateList, completing, reactivating };
}
