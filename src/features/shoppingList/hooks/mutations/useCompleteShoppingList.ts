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
import { sendFields } from '#/apollo/pendingWrites/sendFields';

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
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'ShoppingList', id },
      fields: {
        status: ListStatus.Completed,
        isCompleted: true,
        completedShopDate: now,
      },
      variables: {
        input: {
          id,
          completedShopDate: now,
          ...(totalCost !== undefined && { totalCost }),
        },
      },
      mutate: completeMutation,
      settle: {
        document: CompleteShoppingListDocument,
        fallback: t('shoppingListScreens.failedToComplete'),
      },
    });
    return settled.status !== 'failed';
  };

  const reactivateList = async (id: string): Promise<boolean> => {
    const settled = await sendFields(client.cache, {
      entity: { __typename: 'ShoppingList', id },
      fields: {
        status: ListStatus.Active,
        isCompleted: false,
        completedShopDate: null,
      },
      variables: { input: { id } },
      mutate: reactivateMutation,
      settle: {
        document: MarkShoppingListActiveDocument,
        fallback: t('shoppingListScreens.failedToReactivate'),
      },
    });
    return settled.status !== 'failed';
  };

  return { completeList, reactivateList, completing, reactivating };
}
