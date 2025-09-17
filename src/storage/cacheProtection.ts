/**
 * Cache Protection Utilities
 *
 * Provides safe cache operations that respect token refresh state
 * and prevent inconsistent data during authentication renewal.
 */

import { tokenRefreshStateManager } from './tokenRefreshStateManager';
import { shoppingListStorage } from './shoppingListCache';
import { pantryStorage } from './pantryCache';

/**
 * Safe wrapper for cache operations that respects token refresh state
 */
export class SafeCacheOperations {
  /**
   * Check if cache operations should be blocked
   */
  private static shouldBlockOperation(): boolean {
    return tokenRefreshStateManager.shouldBlockCacheUpdates();
  }

  /**
   * Log blocked operation for debugging
   */
  private static logBlockedOperation(operation: string, context?: string): void {
    console.log(`🚫 Cache operation blocked during token refresh: ${operation}${context ? ` (${context})` : ''}`);
  }

  // ============================================================================
  // SHOPPING LIST SAFE OPERATIONS
  // ============================================================================

  /**
   * Safely set shopping lists with token refresh protection
   */
  static setShoppingLists(lists: any[], userId?: string): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('setShoppingLists', `${lists.length} lists`);
      return false;
    }

    shoppingListStorage.setShoppingLists(lists, userId);
    return true;
  }

  /**
   * Safely update shopping list with token refresh protection
   */
  static updateShoppingList(updatedList: any): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('updateShoppingList', `list ${updatedList.id}`);
      return false;
    }

    shoppingListStorage.updateShoppingList(updatedList);
    return true;
  }

  /**
   * Safely set shopping list items with token refresh protection
   */
  static setShoppingListItems(shoppingListId: string, items: any[]): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('setShoppingListItems', `${items.length} items for list ${shoppingListId}`);
      return false;
    }

    shoppingListStorage.setShoppingListItems(shoppingListId, items);
    return true;
  }

  /**
   * Safely update shopping list item with token refresh protection
   */
  static updateShoppingListItem(shoppingListId: string, updatedItem: any): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('updateShoppingListItem', `item ${updatedItem.id} in list ${shoppingListId}`);
      return false;
    }

    shoppingListStorage.updateShoppingListItem(shoppingListId, updatedItem);
    return true;
  }

  /**
   * Safely mark item as purchased with token refresh protection
   */
  static markItemPurchased(shoppingListId: string, itemId: string, isPurchased: boolean): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('markItemPurchased', `item ${itemId} in list ${shoppingListId}`);
      return false;
    }

    shoppingListStorage.markItemPurchased(shoppingListId, itemId, isPurchased);
    return true;
  }

  // ============================================================================
  // PANTRY SAFE OPERATIONS
  // ============================================================================

  /**
   * Safely set pantry items with token refresh protection
   */
  static setPantryItems(pantryId: string, items: any[]): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('setPantryItems', `${items.length} items for pantry ${pantryId}`);
      return false;
    }

    pantryStorage.setPantryItems(pantryId, items);
    return true;
  }

  /**
   * Safely update pantry item with token refresh protection
   */
  static updatePantryItem(pantryId: string, updatedItem: any): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('updatePantryItem', `item ${updatedItem.id} in pantry ${pantryId}`);
      return false;
    }

    pantryStorage.updateCachedItem(pantryId, updatedItem);
    return true;
  }

  /**
   * Safely remove pantry item with token refresh protection
   */
  static removePantryItem(pantryId: string, itemId: string): boolean {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation('removePantryItem', `item ${itemId} in pantry ${pantryId}`);
      return false;
    }

    pantryStorage.removeCachedItem(pantryId, itemId);
    return true;
  }

  // ============================================================================
  // READ OPERATIONS (ALWAYS ALLOWED)
  // ============================================================================
  // Note: Read operations are always allowed and will use existing cached data

  static getShoppingLists() {
    return shoppingListStorage.getShoppingLists();
  }

  static getShoppingListItems(shoppingListId: string) {
    return shoppingListStorage.getShoppingListItems(shoppingListId);
  }

  static getPantryItems(pantryId: string) {
    return pantryStorage.getPantryItems(pantryId);
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Execute a cache operation with protection
   */
  static executeProtected<T>(
    operation: () => T,
    operationName: string,
    context?: string
  ): T | null {
    if (this.shouldBlockOperation()) {
      this.logBlockedOperation(operationName, context);
      return null;
    }

    try {
      return operation();
    } catch (error) {
      console.error(`Cache operation failed: ${operationName}`, error);
      return null;
    }
  }

  /**
   * Get current protection status
   */
  static getProtectionStatus() {
    const state = tokenRefreshStateManager.getState();
    return {
      isProtected: state.isRefreshing,
      refreshDuration: tokenRefreshStateManager.getRefreshDuration(),
      queuedOperations: state.queuedOperations.length,
    };
  }
}

/**
 * Higher-order function to protect existing cache functions
 */
export function withCacheProtection<T extends (...args: any[]) => any>(
  fn: T,
  operationName: string
): T {
  return ((...args: any[]) => {
    if (tokenRefreshStateManager.shouldBlockCacheUpdates()) {
      console.log(`🚫 Cache operation blocked during token refresh: ${operationName}`);
      return false; // or null, depending on what makes sense for your use case
    }
    return fn(...args);
  }) as T;
}

// Export convenience functions for backward compatibility
export const safeCacheOps = SafeCacheOperations;