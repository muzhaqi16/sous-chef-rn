/**
 * Shared utilities for shopping list item mutations
 */

import type { Unmasked } from '@apollo/client/masking';
import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';
import { createOptimisticEntity } from '#/apollo/utils/createOptimisticResponse';
import { generateId } from '#/utils/generateId';
import type { ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';

interface OptimisticShoppingListItemFields {
  itemName: string;
  quantity?: number | null;
  quantityInput?: string | null;
  unitName?: string | null;
  category?: string | null;
  itemId?: string | null;
  unitId?: string | null;
}

/**
 * Creates an optimistic ShoppingListItem entity with sensible defaults.
 * Returns the temp ID so callers can track it for eviction on server response.
 *
 * Return type is `Unmasked<ShoppingListItemDisplayFragment>` — the structural
 * shape Apollo's `optimisticResponse` (and `cache.writeFragment`) expects when
 * data masking is enabled. Declaring it here means call sites don't need to.
 */
export function createOptimisticShoppingListItem(
  fields: OptimisticShoppingListItemFields,
): { tempId: string; entity: Unmasked<ShoppingListItemDisplayFragment> } {
  const tempId = `temp-${generateId()}`;
  const entity = createOptimisticEntity<
    Unmasked<ShoppingListItemDisplayFragment>
  >('ShoppingListItem', tempId, {
    itemName: fields.itemName,
    quantity: fields.quantity ?? 1,
    quantityInput: fields.quantityInput ?? null,
    displayFormat: undefined,
    unitName: fields.unitName ?? null,
    category: fields.category ?? null,
    notes: null,
    sortOrder: '',
    purchaseInfo: {
      __typename: 'ShoppingListItemPurchaseInfo',
      isPurchased: false,
    },
    item: fields.itemId
      ? { __typename: 'Item', id: fields.itemId, imageUrl: null, images: [] }
      : null,
    unit: fields.unitId
      ? { __typename: 'Unit', id: fields.unitId, name: '', symbol: '' }
      : null,
  });
  return { tempId, entity };
}

// Cache updater for removing items from ShoppingList.itemsConnection
// Uses parent connection pattern for ShoppingList.itemsConnection
export const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );
