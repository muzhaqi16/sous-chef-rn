/**
 * useShoppingListItemMutations - Composition hook for all CRUD mutations
 *
 * This maintains backward compatibility with the original hook.
 * For new code, prefer using individual hooks directly:
 * - useAddShoppingItem
 * - useUpdateShoppingItem
 * - useRemoveShoppingItem
 * - useToggleShoppingItem
 *
 * @example
 * ```tsx
 * // Backward compatible usage
 * const { addItem, updateItem, removeItem, toggleItem } = useShoppingListItemMutations(
 *   listId,
 *   items,
 *   refetch,
 * );
 *
 * // Preferred: Use individual hooks
 * const { addItem } = useAddShoppingItem({ listId, refetch });
 * const { toggleItem } = useToggleShoppingItem({ listId, items, refetch });
 * ```
 */

import { useAddShoppingItem } from './useAddShoppingItem';
import { useUpdateShoppingItem } from './useUpdateShoppingItem';
import { useRemoveShoppingItem } from './useRemoveShoppingItem';
import { useToggleShoppingItem } from './useToggleShoppingItem';

export function useShoppingListItemMutations(
  listId: string | null | undefined,
  refetch: () => Promise<unknown>,
) {
  const { addItem } = useAddShoppingItem({ listId, refetch });
  const { updateItem } = useUpdateShoppingItem({ listId, refetch });
  const { removeItem } = useRemoveShoppingItem({ listId, refetch });
  const { toggleItem, recordPurchase } = useToggleShoppingItem({
    listId,
    refetch,
  });

  return {
    addItem,
    updateItem,
    removeItem,
    toggleItem,
    recordPurchase,
  };
}
