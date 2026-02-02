/**
 * Shared utilities for shopping list item mutations
 */

import {
  createAddToParentConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';

// Helper to detect if error is network-related (skip alerts, let queue handle retry)
export const isNetworkError = (error: any): boolean => {
  const message = (error?.message || error?.networkError?.message || '').toLowerCase();
  const networkPatterns = [
    'network request failed',
    'network error',
    'connection refused',
    'timeout',
    'enotfound',
    'econnrefused',
    'econnreset',
    'unable to reach',
    'no internet',
    'offline',
  ];
  return networkPatterns.some(pattern => message.includes(pattern)) || !!error?.networkError;
};

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
