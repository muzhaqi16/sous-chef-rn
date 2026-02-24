/**
 * Shared utilities for shopping list item mutations
 */

import { createRemoveFromParentConnectionUpdater } from '#/apollo/utils/cacheUpdaters';

// Cache updater for removing items from ShoppingList.itemsConnection
// Uses parent connection pattern for ShoppingList.itemsConnection
export const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );
