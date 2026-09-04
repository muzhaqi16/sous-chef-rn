import { useMutation } from '@apollo/client/react';
import { ShareShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';

/**
 * Open a list to its share code, or close it again. No cache update needed: the
 * mutation returns `shoppingList { id, shareCode, isPublic }`, which Apollo
 * normalizes by entity key.
 */
export function useShareShoppingList() {
  const [shareShoppingList] = useMutation(ShareShoppingListDocument);

  const setListPublic = async (listId: string, isPublic: boolean) => {
    const { data } = await shareShoppingList({
      variables: { input: { id: listId, isPublic } },
    });
    return data?.shareShoppingList;
  };

  return { setListPublic };
}
