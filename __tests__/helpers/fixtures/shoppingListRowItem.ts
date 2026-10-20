import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';

/**
 * One line of the shopping-list FlashList. The row reads
 * `ShoppingListItem:<id>` by its `id`, so a suite that renders the row seeds
 * that entity.
 */
export function shoppingListRowItem(
  id: string,
  overrides: Partial<Omit<ShoppingListRowItem, 'id'>> = {},
): ShoppingListRowItem {
  return {
    id,
    isPurchased: false,
    sortOrder: id,
    storeDepartment: StoreDepartment.Other,
    ...overrides,
  };
}
