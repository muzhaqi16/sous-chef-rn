import type { SortableShoppingListItem, SortOrderUpdate, Positions, GroupBoundary } from '../types';

/**
 * Calculate new sortOrder for an item moved to a specific position
 */
export const calculateNewSortOrder = (
  items: SortableShoppingListItem[],
  targetIndex: number
): number => {
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  if (targetIndex === 0) {
    // Moving to top - place before first item
    const firstSort = sortedItems[0]?.sortOrder ?? 0;
    return firstSort - 1;
  } else if (targetIndex >= sortedItems.length) {
    // Moving to bottom - place after last item
    const lastSort = sortedItems[sortedItems.length - 1]?.sortOrder ?? 0;
    return lastSort + 1;
  } else {
    // Moving between items - use midpoint
    const prevSort = sortedItems[targetIndex - 1].sortOrder;
    const nextSort = sortedItems[targetIndex].sortOrder;
    return (prevSort + nextSort) / 2;
  }
};

/**
 * Check if sortOrder values are getting too close together (< 0.1 apart)
 */
export const needsRenumbering = (items: SortableShoppingListItem[]): boolean => {
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  for (let i = 1; i < sortedItems.length; i++) {
    const diff = sortedItems[i].sortOrder - sortedItems[i - 1].sortOrder;
    if (Math.abs(diff) < 0.1) {
      return true;
    }
  }
  return false;
};

/**
 * Renumber all items with clean spacing (multiples of 10)
 */
export const renumberAllItems = (items: SortableShoppingListItem[]): SortOrderUpdate[] => {
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return sortedItems.map((item, index) => ({
    id: item.id,
    sortOrder: index * 10,
  }));
};

/**
 * Convert drag positions to reordered items array
 */
export const getReorderedItems = (
  items: SortableShoppingListItem[],
  positions: Positions,
  _itemHeight: number
): SortableShoppingListItem[] => {
  // Convert positions to array of [index, yPosition] pairs and sort by yPosition
  const positionArray = Object.entries(positions)
    .map(([index, yPos]) => [parseInt(index), yPos] as [number, number])
    .sort((a, b) => a[1] - b[1]);

  // Extract the new order of indices
  const newOrder = positionArray.map(([index]) => index);

  // Return items in the new order
  return newOrder.map(index => items[index]);
};

/**
 * Calculate which items need sortOrder updates after reordering
 */
export const calculateSortOrderUpdates = (
  originalItems: SortableShoppingListItem[],
  reorderedItems: SortableShoppingListItem[]
): SortOrderUpdate[] => {
  const updates: SortOrderUpdate[] = [];

  // Check if we need bulk renumbering first
  if (needsRenumbering(reorderedItems)) {
    return renumberAllItems(reorderedItems);
  }

  // Calculate updates for items that changed position
  for (let i = 0; i < reorderedItems.length; i++) {
    const item = reorderedItems[i];
    const originalIndex = originalItems.findIndex(orig => orig.id === item.id);

    if (originalIndex !== i) {
      // Item moved - calculate new sortOrder
      const newSortOrder = calculateNewSortOrder(originalItems, i);
      updates.push({
        id: item.id,
        sortOrder: newSortOrder,
      });
    }
  }

  return updates;
};

/**
 * Group items by purchased status while maintaining sort order within groups
 */
export const groupItemsByPurchased = (
  items: SortableShoppingListItem[]
): {
  unpurchased: SortableShoppingListItem[];
  purchased: SortableShoppingListItem[];
} => {
  const sortedItems = [...items].sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    unpurchased: sortedItems.filter(item => !item.isPurchased),
    purchased: sortedItems.filter(item => item.isPurchased),
  };
};

/**
 * Calculate group boundaries for drag constraints
 */
export const calculateGroupBoundaries = (
  items: SortableShoppingListItem[],
  itemHeight: number
): { unpurchased: GroupBoundary | null; purchased: GroupBoundary | null } => {
  const { unpurchased, purchased } = groupItemsByPurchased(items);

  const unpurchasedBoundary = unpurchased.length > 0 ? {
    startIndex: 0,
    endIndex: unpurchased.length - 1,
    startY: 0,
    endY: (unpurchased.length - 1) * itemHeight,
  } : null;

  const purchasedBoundary = purchased.length > 0 ? {
    startIndex: unpurchased.length,
    endIndex: unpurchased.length + purchased.length - 1,
    startY: unpurchased.length * itemHeight,
    endY: (unpurchased.length + purchased.length - 1) * itemHeight,
  } : null;

  return { unpurchased: unpurchasedBoundary, purchased: purchasedBoundary };
};

/**
 * Get the group boundary for a specific item index
 */
export const getGroupBoundaryForItem = (
  items: SortableShoppingListItem[],
  itemIndex: number,
  itemHeight: number
): GroupBoundary | null => {
  const { unpurchased, purchased } = calculateGroupBoundaries(items, itemHeight);
  const item = items[itemIndex];

  if (!item) return null;

  if (item.isPurchased) {
    return purchased;
  } else {
    return unpurchased;
  }
};

/**
 * Constrain a drag position to stay within group boundaries
 */
export const constrainToGroupBoundary = (
  targetY: number,
  groupBoundary: GroupBoundary | null,
  _itemHeight: number
): number => {
  if (!groupBoundary) return targetY;

  const minY = groupBoundary.startY;
  const maxY = groupBoundary.endY;

  return Math.max(minY, Math.min(maxY, targetY));
};