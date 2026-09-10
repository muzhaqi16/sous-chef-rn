/**
 * Shared utilities for shopping list item mutations
 */

import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

// `createOptimisticShoppingListItem` lives in
// `#features/shoppingList/cache/items`, so add surfaces in other features build
// the same optimistic entity rather than each shaping its own.

// Cache updater for removing items from ShoppingList.itemsConnection
// Uses parent connection pattern for ShoppingList.itemsConnection
export const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );
