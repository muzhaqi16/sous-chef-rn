import { useMutation } from '@apollo/client/react';
import { CreateShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { createAddToQueryConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { unwrapPayload } from '#/utils/compilerSafeWrappers';
import type { CreateShoppingListInput } from '#/graphql/generated/schemaTypes';

const addToShoppingListsCache = createAddToQueryConnectionUpdater(
  'shoppingLists',
  'ShoppingList',
);

export function useCreateShoppingList(fallbackErrorMessage: string) {
  const [mutate, { loading }] = useMutation(CreateShoppingListDocument, {
    update(cache, { data }) {
      if (
        data?.createShoppingList?.__typename === 'CreateShoppingListPayload'
      ) {
        addToShoppingListsCache(cache, data.createShoppingList.shoppingList);
      }
    },
  });

  const createShoppingList = async (input: CreateShoppingListInput) => {
    const response = await mutate({ variables: { input } });

    const payload = unwrapPayload(
      response.data?.createShoppingList,
      'CreateShoppingListPayload',
      fallbackErrorMessage,
    );

    return payload.shoppingList;
  };

  return { createShoppingList, loading };
}
