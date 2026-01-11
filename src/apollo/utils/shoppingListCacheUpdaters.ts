/**
 * Shopping List Cache Updaters
 *
 * Reusable cache update utilities for shopping list items.
 * Used by both mutations and subscriptions to ensure consistent cache updates
 * when items move between purchased/unpurchased states.
 *
 * These utilities handle the dual cache structure:
 * - `itemsConnection` field (used by GetShoppingListQuery)
 * - `unpurchasedItems`/`purchasedItems` aliased fields (used by GetShoppingListItemsPaginatedQuery)
 *
 * Apollo caches aliased fields under the alias name, NOT the underlying field name.
 * So we need separate utilities for each aliased field.
 */

import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from './cacheUpdaters';

// =============================================================================
// itemsConnection field (used by GetShoppingListQuery)
// =============================================================================

/**
 * Add item to ShoppingList.itemsConnection
 */
export const addToShoppingListItemsConnection = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

/**
 * Remove item from ShoppingList.itemsConnection
 */
export const removeFromShoppingListItemsConnection = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'itemsConnection',
  'ShoppingListItem',
);

// =============================================================================
// Aliased fields (used by GetShoppingListItemsPaginatedQuery)
// =============================================================================

/**
 * Add item to ShoppingList.unpurchasedItems (alias for itemsConnection with isPurchased: false)
 */
export const addToUnpurchasedItems = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'unpurchasedItems',
  'ShoppingListItem',
);

/**
 * Remove item from ShoppingList.unpurchasedItems
 */
export const removeFromUnpurchasedItems = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'unpurchasedItems',
  'ShoppingListItem',
);

/**
 * Add item to ShoppingList.purchasedItems (alias for itemsConnection with isPurchased: true)
 */
export const addToPurchasedItems = createAddToParentConnectionUpdater<any>(
  'ShoppingList',
  'purchasedItems',
  'ShoppingListItem',
);

/**
 * Remove item from ShoppingList.purchasedItems
 */
export const removeFromPurchasedItems = createRemoveFromParentConnectionUpdater(
  'ShoppingList',
  'purchasedItems',
  'ShoppingListItem',
);
