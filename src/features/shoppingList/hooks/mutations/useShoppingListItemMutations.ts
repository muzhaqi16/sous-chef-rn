// Convenience composition; new code should reach for the individual hooks.

import { useAddShoppingItem } from './useAddShoppingItem';
import { useRemoveShoppingItem } from './useRemoveShoppingItem';
import { useToggleShoppingItem } from './useToggleShoppingItem';

export function useShoppingListItemMutations(
  listId: string | null | undefined,
  refetch: () => Promise<unknown>,
) {
  const { addItem } = useAddShoppingItem({ listId, refetch });
  const { removeItem } = useRemoveShoppingItem({ listId, refetch });
  const { toggleItem, recordPurchase } = useToggleShoppingItem({
    listId,
    refetch,
  });

  return {
    addItem,
    removeItem,
    toggleItem,
    recordPurchase,
  };
}
