/**
 * Utility functions for SortableShoppingList component.
 *
 * Operate on a structural subset of the row item shape (just `id` +
 * `sortOrder`) so they work against both the lightweight `ShoppingListRowItem`
 * the FlashList sees and any other id-bearing entity in tests.
 */

interface ItemLike {
  id: string;
  sortOrder?: string | null;
}

// Re-exported alias kept for backwards compatibility with existing imports.
type SortableShoppingListItem = ItemLike;

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

  return originalItems.some((item, index) => item.id !== newItems[index].id);
}

/**
 * Find which item was moved by comparing original and reordered arrays
 *
 * Uses "max distance" algorithm: The dragged item is the one that moved
 * the farthest from its original position. When you drag one item, only
 * that item makes a big jump - the others just shift by 1 position.
 *
 * @param originalItems - Original order before drag
 * @param reorderedItems - New order after drag
 * @returns Object with moved item's ID and new index, or null if not found
 */
export function findMovedItem(
  originalItems: SortableShoppingListItem[],
  reorderedItems: SortableShoppingListItem[],
): { itemId: string; newIndex: number } | null {
  // Build a map of original positions
  const originalIndexMap = new Map<string, number>();
  originalItems.forEach((item, index) => {
    originalIndexMap.set(item.id, index);
  });

  // Find the item whose position changed the most (the dragged item)
  // When dragging, only ONE item moves - the rest shift by 1
  let movedItemId: string | null = null;
  let movedNewIndex = -1;
  let maxDistance = 0;

  for (let newIndex = 0; newIndex < reorderedItems.length; newIndex++) {
    const item = reorderedItems[newIndex];
    const originalIndex = originalIndexMap.get(item.id);

    if (originalIndex === undefined) continue;

    const distance = Math.abs(newIndex - originalIndex);
    if (distance > maxDistance) {
      maxDistance = distance;
      movedItemId = item.id;
      movedNewIndex = newIndex;
    }
  }

  if (movedItemId && movedNewIndex >= 0) {
    return { itemId: movedItemId, newIndex: movedNewIndex };
  }

  return null;
}

/**
 * Get the IDs and sortOrder values of items that should be before and after a given position
 * @param items - Array of items
 * @param index - Index position to get neighbors for
 * @returns Object with afterId, afterSortOrder (item before) and beforeId, beforeSortOrder (item after)
 */
export function getNeighborIds(
  items: SortableShoppingListItem[],
  index: number,
): {
  afterId: string | null;
  afterSortOrder: string | null;
  beforeId: string | null;
  beforeSortOrder: string | null;
} {
  const afterItem = index > 0 ? items[index - 1] : null;
  const beforeItem = index < items.length - 1 ? items[index + 1] : null;

  return {
    afterId: afterItem?.id ?? null,
    afterSortOrder: afterItem?.sortOrder ?? null,
    beforeId: beforeItem?.id ?? null,
    beforeSortOrder: beforeItem?.sortOrder ?? null,
  };
}
