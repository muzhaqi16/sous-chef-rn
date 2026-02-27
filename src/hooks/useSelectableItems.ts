import { useEffect, useState } from 'react';

export interface SelectableItem {
  id: string;
  selected: boolean;
}

interface UseSelectableItemsOptions<T extends SelectableItem> {
  initialItems: T[];
  maxSelection?: number;
}

interface UseSelectableItemsReturn<T extends SelectableItem> {
  items: T[];
  selectedItems: T[];
  toggleItem: (itemId: string) => void;
  isMaxReached: boolean;
  clearSelection: () => void;
}

/**
 * Custom hook for managing multi-select state with optional max selection limit
 *
 * @param initialItems - Array of items with `id` and `selected` properties
 * @param maxSelection - Optional maximum number of items that can be selected
 * @returns Object containing items, selectedItems, toggleItem function, and isMaxReached flag
 *
 * @example
 * const { items, selectedItems, toggleItem, isMaxReached } = useSelectableItems({
 *   initialItems: myItems,
 *   maxSelection: 5
 * });
 */
export function useSelectableItems<T extends SelectableItem>({
  initialItems,
  maxSelection }: UseSelectableItemsOptions<T>): UseSelectableItemsReturn<T> {
  const [items, setItems] = useState<T[]>(initialItems);

  // Sync internal state when initialItems prop changes
  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  // Memoized toggle function to prevent unnecessary re-renders
  const toggleItem = (itemId: string) => {
      setItems(prevItems => {
        const itemToToggle = prevItems.find(item => item.id === itemId);

        // If item not found, return unchanged
        if (!itemToToggle) {
          return prevItems;
        }

        // If trying to select but max is reached, prevent selection
        if (
          !itemToToggle.selected &&
          maxSelection !== undefined
        ) {
          const currentSelectedCount = prevItems.filter(
            item => item.selected,
          ).length;

          if (currentSelectedCount >= maxSelection) {
            console.warn(
              `Maximum selection of ${maxSelection} items reached`,
            );
            return prevItems;
          }
        }

        // Toggle the item's selected state immutably
        return prevItems.map(item =>
          item.id === itemId
            ? ({ ...item, selected: !item.selected } as T)
            : item,
        );
      });
    };

  // Memoized function to clear all selections
  const clearSelection = () => {
    setItems(prevItems =>
      prevItems.map(item => ({ ...item, selected: false } as T)),
    );
  };

  // Compute derived state
  const selectedItems = items.filter(item => item.selected);
  const isMaxReached =
    maxSelection !== undefined && selectedItems.length >= maxSelection;

  return {
    items,
    selectedItems,
    toggleItem,
    isMaxReached,
    clearSelection };
}
