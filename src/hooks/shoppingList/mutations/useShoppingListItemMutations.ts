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

import type { ShoppingListItemDisplayFragment } from '#generated';
import { useAddShoppingItem } from './useAddShoppingItem';
import { useUpdateShoppingItem } from './useUpdateShoppingItem';
import { useRemoveShoppingItem } from './useRemoveShoppingItem';
import { useToggleShoppingItem } from './useToggleShoppingItem';

// Types are available from './types' directly
// import type { ShoppingListItemInput, ShoppingListItemUpdate } from '#hooks/shoppingList/mutations/types';
// isNetworkError is available from './utils' directly
// import { isNetworkError } from '#hooks/shoppingList/mutations/utils';

export function useShoppingListItemMutations(
  listId: string | null | undefined,
  items: ShoppingListItemDisplayFragment[],
  refetch: () => Promise<any>,
) {
  const { addItem } = useAddShoppingItem({ listId, refetch });
  const { updateItem } = useUpdateShoppingItem({ listId, items, refetch });
  const { removeItem } = useRemoveShoppingItem({ listId, items, refetch });
  const { toggleItem } = useToggleShoppingItem({ listId, items, refetch });

  return {
    addItem,
    updateItem,
    removeItem,
    toggleItem,
  };
}
