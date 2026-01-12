/**
 * useShoppingListItemMutations - DEPRECATED: Re-exports from split hooks
 *
 * This file is maintained for backward compatibility.
 * For new code, import directly from './mutations':
 *
 * @example
 * ```tsx
 * // Individual hooks (preferred)
 * import { useAddShoppingItem } from '#/hooks/shoppingList/mutations';
 * import { useToggleShoppingItem } from '#/hooks/shoppingList/mutations';
 *
 * // Composition hook (backward compatible)
 * import { useShoppingListItemMutations } from '#/hooks/shoppingList/mutations';
 * ```
 */

export {
  useShoppingListItemMutations,
  useAddShoppingItem,
  useUpdateShoppingItem,
  useRemoveShoppingItem,
  useToggleShoppingItem,
  isNetworkError,
} from './mutations';

export type {
  ShoppingListItemInput,
  ShoppingListItemUpdate,
} from './mutations';
