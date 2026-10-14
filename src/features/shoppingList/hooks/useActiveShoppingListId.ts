import { useSelectedShoppingListId } from '#store/useAppStore';

/**
 * The list the user works in, of the `lists` the caller holds: the one they
 * selected, else the default, else the first.
 */
export function useActiveShoppingListId(
  lists: readonly { id: string; isDefault: boolean }[],
): string | undefined {
  const selectedId = useSelectedShoppingListId();
  return (
    lists.find(list => list.id === selectedId) ??
    lists.find(list => list.isDefault) ??
    lists[0]
  )?.id;
}
