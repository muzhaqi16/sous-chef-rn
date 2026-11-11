/**
 * Local-first: the list is hidden until the server answers, so the delete
 * survives an offline queue — a list already gone counts as deleted.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { DeleteShoppingListDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useTranslation } from '#/i18n';
import { useStore } from '#store';

export function useDeleteShoppingList() {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [mutate] = useMutation(DeleteShoppingListDocument, {
    context: { localFirst: true },
  });

  /** `true` once the list is gone or its delete is queued; `false` when refused. */
  const deleteShoppingList = async (id: string): Promise<boolean> => {
    // The removal shows at once and the List moves off the list with it; a
    // refusal brings the list back, so the person goes back to it too.
    const wasShown = useStore.getState().selectedShoppingListId === id;
    // Toasted rather than alerted: the list simply reappears where it was.
    const settled = await pendingWritesOf(client.cache).send(
      DeleteShoppingListDocument,
      { input: { id } },
      write =>
        settleMutation(() => mutate(write), {
          document: DeleteShoppingListDocument,
          fallback: t('errors.deleteShoppingListFailed'),
          removal: true,
          present: 'toast',
        }),
    );
    if (settled.status !== 'failed') return true;
    if (wasShown) useStore.getState().setSelectedShoppingListId(id);
    return false;
  };

  return { deleteShoppingList };
}
