import { useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createRemoveFromQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { toastService } from '#/services/toastService';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { getErrorMessage } from '#/services/errorService';

const removeFromShoppingListsCache = createRemoveFromQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

export function useDeleteShoppingList() {
  const [mutate, { loading }] = useMutation(DeleteShoppingListDocument, {
    onError: (error: any) => {
      toastService.error(getErrorMessage(error));
    },
    update: (cache, { data }, { variables }) => {
      if (
        data?.deleteShoppingList?.__typename !== 'DeleteShoppingListPayload' ||
        !variables
      ) {
        return;
      }

      executeCacheUpdate(
        () =>
          removeFromShoppingListsCache(cache, variables.input.id, {
            evictItem: true,
          }),
        'Cache update failed for deleteShoppingList:',
      );
    },
  });

  const deleteShoppingList = (id: string) =>
    mutate({ variables: { input: { id } } });

  return { deleteShoppingList, loading };
}
