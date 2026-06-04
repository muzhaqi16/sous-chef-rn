/**
 * Shared utilities for shopping list item mutations
 */

import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

// `createOptimisticShoppingListItem` now lives in
// `#/apollo/utils/shoppingListCacheUpdaters` (a shared apollo util) so add
// surfaces in other features can build the same optimistic entity without
// crossing a feature boundary.

// Cache updater for removing items from ShoppingList.itemsConnection
// Uses parent connection pattern for ShoppingList.itemsConnection
export const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );
