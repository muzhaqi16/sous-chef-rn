/**
 * Local-first: the list is hidden until the server answers, so the delete
 * survives an offline queue — a list already gone counts as deleted.
 */

import { useLocalWrite } from '#apollo/pendingWrites/useLocalWrite';
import { useTranslation } from '#i18n';
import { useStore } from '#store';
import { deleteShoppingListWrite } from '#features/shoppingList/offline/localWrites';

export function useDeleteShoppingList() {
  const { t } = useTranslation();

  // Toasted rather than alerted: the list simply reappears where it was.
  const remove = useLocalWrite(deleteShoppingListWrite, {
    fallback: t('errors.deleteShoppingListFailed'),
    removal: true,
    present: 'toast',
  });

  /** `true` once the list is gone or its delete is queued; `false` when refused. */
  const deleteShoppingList = async (id: string): Promise<boolean> => {
    // The removal shows at once and the List moves off the list with it; a
    // refusal brings the list back, so the person goes back to it too.
    const wasShown = useStore.getState().selectedShoppingListId === id;
    const settled = await remove.send({ input: { id } });
    if (settled.status !== 'failed') return true;
    if (wasShown) useStore.getState().setSelectedShoppingListId(id);
    return false;
  };

  return { deleteShoppingList };
}
