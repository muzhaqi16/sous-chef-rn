import { useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createRemoveFromQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { useErrorService } from '#/services/errorService';
import { toastService } from '#/services/toastService';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';

const removeFromShoppingListsCache = createRemoveFromQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

export function useDeleteShoppingList() {
  const { handleApolloError } = useErrorService();

  const [mutate, { loading }] = useMutation(DeleteShoppingListDocument, {
    onError: (error: any) => {
      const { message } = handleApolloError(error, {
        operation: 'Delete Shopping List',
      });
      toastService.error(message);
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
