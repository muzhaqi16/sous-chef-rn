import type { FragmentType } from '@apollo/client/masking';
import { StoreDepartment } from '#/graphql/generated/schemaTypes';
import type { ShoppingListRowItem } from '#features/shoppingList/components/SortableShoppingList/types';
import type { SortableItem_ItemFragmentDoc } from '#features/shoppingList/components/SortableShoppingList/SortableItem.generated';

/**
 * One line of the shopping-list FlashList. Its `itemRef` points at
 * `ShoppingListItem:<id>`: `useFragment` reads only `__typename` + `id` off a
 * masked ref, so a suite that renders the row seeds that entity.
 */
export function shoppingListRowItem(
  id: string,
  overrides: Partial<Omit<ShoppingListRowItem, 'id' | 'itemRef'>> = {},
): ShoppingListRowItem {
  return {
    id,
    isPurchased: false,
    sortOrder: id,
    storeDepartment: StoreDepartment.Other,
    itemRef: { __typename: 'ShoppingListItem', id } as FragmentType<
      typeof SortableItem_ItemFragmentDoc
    >,
    ...overrides,
  };
}
