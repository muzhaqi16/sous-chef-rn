import { useSelectedShoppingListId } from '#store/useAppStore';

/**
 * The list the user works in, of the `lists` the caller holds: the one they
 * selected, else the default, else the first.
 */
export const activeShoppingListId = (
  lists: readonly { id: string; isDefault: boolean }[],
  selectedId: string | null,
): string | undefined =>
  (
    lists.find(list => list.id === selectedId) ??
    lists.find(list => list.isDefault) ??
    lists[0]
  )?.id;

export function useActiveShoppingListId(
  lists: readonly { id: string; isDefault: boolean }[],
): string | undefined {
  return activeShoppingListId(lists, useSelectedShoppingListId());
}
