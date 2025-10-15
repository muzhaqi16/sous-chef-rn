import type { SortableShoppingListItem, SortOrderUpdate, Positions } from '../types';
import { getReorderedItems, calculateSortOrderUpdates } from './sortOrder';

export interface OptimisticUpdateResult {
  reorderedItems: SortableShoppingListItem[];
  updates: SortOrderUpdate[];
  hasChanges: boolean;
}

/**
 * Handle optimistic updates for drag and drop operations
 */
export class OptimisticUpdateHandler {
  private originalItems: SortableShoppingListItem[];
  private onSortOrderUpdate?: (updates: SortOrderUpdate[]) => Promise<void>;

  constructor(
    items: SortableShoppingListItem[],
    onSortOrderUpdate?: (updates: SortOrderUpdate[]) => Promise<void>
  ) {
    this.originalItems = [...items];
    this.onSortOrderUpdate = onSortOrderUpdate;
  }

  /**
   * Process drag end and return optimistic update result
   */
  processDropDrop(
    positions: Positions,
    itemHeight: number
  ): OptimisticUpdateResult {
    const reorderedItems = getReorderedItems(
      this.originalItems,
      positions,
      itemHeight
    );

    const updates = calculateSortOrderUpdates(
      this.originalItems,
      reorderedItems
    );

    return {
      reorderedItems,
      updates,
      hasChanges: updates.length > 0,
    };
  }

  /**
   * Apply optimistic updates and sync with server
   */
  async applyUpdates(
    result: OptimisticUpdateResult,
    onLocalUpdate: (items: SortableShoppingListItem[]) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (!result.hasChanges) {
      return;
    }

    // 1. Apply optimistic updates immediately
    const optimisticItems = this.applyOptimisticSortOrder(
      result.reorderedItems,
      result.updates
    );
    onLocalUpdate(optimisticItems);

    // 2. Sync with server
    if (this.onSortOrderUpdate) {
      try {
        await this.onSortOrderUpdate(result.updates);
        // Success - keep optimistic updates
      } catch (error) {
        // Error - revert to original order
        onLocalUpdate(this.originalItems);
        if (onError) {
          onError(error as Error);
        }
      }
    }
  }

  /**
   * Apply sortOrder updates to items for optimistic UI
   */
  private applyOptimisticSortOrder(
    items: SortableShoppingListItem[],
    updates: SortOrderUpdate[]
  ): SortableShoppingListItem[] {
    const updateMap = new Map(updates.map(u => [u.id, u.sortOrder]));

    return items.map(item => {
      const newSortOrder = updateMap.get(item.id);
      if (newSortOrder !== undefined) {
        return { ...item, sortOrder: newSortOrder };
      }
      return item;
    });
  }
}

/**
 * Utility function for simple drag end handling
 */
export const handleDragEnd = async (
  items: SortableShoppingListItem[],
  positions: Positions,
  itemHeight: number,
  options: {
    onLocalUpdate: (items: SortableShoppingListItem[]) => void;
    onSortOrderUpdate?: (updates: SortOrderUpdate[]) => Promise<void>;
    onError?: (error: Error) => void;
  }
): Promise<void> => {
  const handler = new OptimisticUpdateHandler(items, options.onSortOrderUpdate);
  const result = handler.processDropDrop(positions, itemHeight);

  await handler.applyUpdates(
    result,
    options.onLocalUpdate,
    options.onError
  );
};

/**
 * Check if drag actually changed item positions
 */
export const hasPositionChanges = (
  originalItems: SortableShoppingListItem[],
  positions: Positions,
  itemHeight: number
): boolean => {
  const reorderedItems = getReorderedItems(originalItems, positions, itemHeight);

  for (let i = 0; i < originalItems.length; i++) {
    if (originalItems[i].id !== reorderedItems[i].id) {
      return true;
    }
  }

  return false;
};