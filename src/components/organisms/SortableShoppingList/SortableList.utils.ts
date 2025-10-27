/**
 * Utility functions for SortableShoppingList component
 */

import type { SortableShoppingListItem } from './types';

/**
 * Compare two arrays of items by their IDs to check if items were added/removed
 * @param items1 - First array of items
 * @param items2 - Second array of items
 * @returns true if the IDs are identical (same items), false otherwise
 */
export function areItemIdsEqual(
  items1: SortableShoppingListItem[],
  items2: SortableShoppingListItem[],
): boolean {
  if (items1.length !== items2.length) return false;

  const ids1 = items1.map(item => item.id).join(',');
  const ids2 = items2.map(item => item.id).join(',');

  return ids1 === ids2;
}

/**
 * Check if the order of items has changed by comparing IDs at each position
 * @param originalItems - Original order of items
 * @param newItems - New order of items
 * @returns true if the order changed, false otherwise
 */
export function hasOrderChanged(
  originalItems: SortableShoppingListItem[],
  newItems: SortableShoppingListItem[],
): boolean {
  if (originalItems.length !== newItems.length) return true;

  return originalItems.some(
    (item, index) => item.id !== newItems[index].id,
  );
}

/**
 * Find which item was moved by comparing original and reordered arrays
 * @param originalItems - Original order before drag
 * @param reorderedItems - New order after drag
 * @returns Object with moved item's ID and new index, or null if not found
 */
export function findMovedItem(
  originalItems: SortableShoppingListItem[],
  reorderedItems: SortableShoppingListItem[],
): { itemId: string; newIndex: number } | null {
  // Search from start
  for (let i = 0; i < reorderedItems.length; i++) {
    if (originalItems[i]?.id !== reorderedItems[i]?.id) {
      return {
        itemId: reorderedItems[i].id,
        newIndex: i,
      };
    }
  }

  // Search from end (fallback)
  for (let i = reorderedItems.length - 1; i >= 0; i--) {
    if (originalItems[i]?.id !== reorderedItems[i]?.id) {
      return {
        itemId: reorderedItems[i].id,
        newIndex: i,
      };
    }
  }

  return null;
}

/**
 * Get the IDs of items that should be before and after a given position
 * @param items - Array of items
 * @param index - Index position to get neighbors for
 * @returns Object with afterId (item before) and beforeId (item after)
 */
export function getNeighborIds(
  items: SortableShoppingListItem[],
  index: number,
): { afterId: string | null; beforeId: string | null } {
  const afterId = index > 0 ? items[index - 1].id : null;
  const beforeId = index < items.length - 1 ? items[index + 1].id : null;

  return { afterId, beforeId };
}
