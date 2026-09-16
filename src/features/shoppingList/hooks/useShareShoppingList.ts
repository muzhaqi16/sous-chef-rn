import { useMutation } from '@apollo/client/react';
import { ShareShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { settleMutation } from '#/apollo/utils/settleMutation';

/**
 * Open a list to its share code, or close it again. No cache update needed: the
 * mutation returns `shoppingList { id, shareCode, isPublic }`, which Apollo
 * normalizes by entity key.
 */
export function useShareShoppingList() {
  const [shareShoppingList] = useMutation(ShareShoppingListDocument);

  /** @returns whether sharing now reads as the caller asked. */
  const setListPublic = async (
    listId: string,
    isPublic: boolean,
    failureMessage: string,
  ): Promise<boolean> => {
    const settled = await settleMutation(
      () =>
        shareShoppingList({
          variables: { input: { id: listId, isPublic } },
        }),
      { document: ShareShoppingListDocument, fallback: failureMessage },
    );
    return settled.status !== 'failed';
  };

  return { setListPublic };
}
