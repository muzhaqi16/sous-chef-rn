/**
 * Shared utilities for shopping list item mutations
 */

import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

// Cache updater utilities for shopping list items connection
// Uses parent connection pattern for ShoppingList.itemsConnection
export const addToShoppingListItemsCache = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

export const removeFromShoppingListItemsCache =
  createRemoveFromParentConnectionUpdater(
    'ShoppingList',
    'itemsConnection',
    'ShoppingListItem',
  );
