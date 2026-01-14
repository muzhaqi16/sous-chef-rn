/**
 * Apollo Cache Utilities
 *
 * Barrel export for cache-related utility functions
 */

export {
  // Types
  type InsertPosition,
  type AddToArrayOptions,
  type AddToConnectionOptions,
  type RemoveFromArrayOptions,
  // Query root field updaters
  createAddToQueryFieldUpdater,
  createAddToKeyedQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
  createRemoveFromQueryConnectionUpdater,
  // Parent entity field updaters
  createAddToParentConnectionUpdater,
  createAddToParentArrayUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromParentArrayUpdater,
  // Direct eviction
  createItemEvictor,
} from './cacheUpdaters';

export {
  // Shopping list connection updaters
  addToShoppingListItemsConnection,
  removeFromShoppingListItemsConnection,
  // Shopping list aliased field updaters
  addToUnpurchasedItems,
  removeFromUnpurchasedItems,
  addToPurchasedItems,
  removeFromPurchasedItems,
  // High-level move utilities (handles both itemsConnection and aliased fields)
  moveShoppingListItemToPurchased,
  moveShoppingListItemToUnpurchased,
  // Batch clear utility
  clearAllPurchasedItemsFromCache,
} from './shoppingListCacheUpdaters';
