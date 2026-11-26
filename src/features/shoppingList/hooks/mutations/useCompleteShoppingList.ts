/**
 * Local-first: the new status is written to the cache PERMANENTLY before firing —
 * an absolute set keyed by the list id, so a queued replay re-applies it
 * idempotently. A failure reverts the write; a queued one keeps it.
 */

import { useTranslation } from '#i18n';
import { ListStatus } from '#graphql/generated/schemaTypes';
import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import {
  completeShoppingListWrite,
  markShoppingListActiveWrite,
} from '#features/shoppingList/offline/localWrites';

export function useCompleteShoppingList() {
  const { t } = useTranslation();
  const complete = useLocalWrite(completeShoppingListWrite, {
    fallback: t('shoppingListScreens.failedToComplete'),
  });
  const reactivate = useLocalWrite(markShoppingListActiveWrite, {
    fallback: t('shoppingListScreens.failedToReactivate'),
  });

  const completeList = async (
    id: string,
    totalCost?: number,
  ): Promise<boolean> => {
    const now = new Date().toISOString();
    const settled = await complete.send(
      {
        input: {
          id,
          completedShopDate: now,
          ...(totalCost !== undefined && { totalCost }),
        },
      },
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
    const settled = await reactivate.send(
      { input: { id } },
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

  return {
    completeList,
    reactivateList,
    completing: complete.sending,
    reactivating: reactivate.sending,
  };
}
