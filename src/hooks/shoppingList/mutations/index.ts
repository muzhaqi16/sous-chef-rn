/**
 * Shopping List Item Mutations
 *
 * Split into focused, single-responsibility hooks:
 * - useAddShoppingItem: Add new items
 * - useUpdateShoppingItem: Update existing items
 * - useRemoveShoppingItem: Remove items
 * - useToggleShoppingItem: Toggle purchase status
 *
 * This index provides both:
 * 1. Individual hooks for fine-grained usage
 * 2. Composition hook for backward compatibility
 */

// Individual hooks
export { useAddShoppingItem } from './useAddShoppingItem';
export { useUpdateShoppingItem } from './useUpdateShoppingItem';
export { useRemoveShoppingItem } from './useRemoveShoppingItem';
export { useToggleShoppingItem } from './useToggleShoppingItem';
export { useClearShoppingListItems } from './useClearShoppingListItems';

// Types
export type { ShoppingListItemInput, ShoppingListItemUpdate } from './types';

// Re-export utilities for advanced usage
export { isNetworkError } from './utils';

// ============================================================
// Composition hook - backward compatible with useShoppingListItemMutations
// ============================================================

import type { ShoppingListItemDisplayFragment } from '#generated';
import { useAddShoppingItem } from './useAddShoppingItem';
import { useUpdateShoppingItem } from './useUpdateShoppingItem';
import { useRemoveShoppingItem } from './useRemoveShoppingItem';
import { useToggleShoppingItem } from './useToggleShoppingItem';

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
