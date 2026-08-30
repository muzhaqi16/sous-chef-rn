import { useState } from 'react';
import { logger } from '#/utils/environment';

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

/** Shared empty map so the untouched case never allocates. */
const NO_OVERRIDES: ReadonlyMap<string, boolean> = new Map();

/**
 * Multi-select state with an optional cap. State holds only the user's EXPLICIT
 * choices; an untouched item reads `selected` off `initialItems`, so a refreshed
 * seed updates untouched rows without discarding taps already made.
 */
export function useSelectableItems<T extends SelectableItem>({
  initialItems,
  maxSelection,
}: UseSelectableItemsOptions<T>): UseSelectableItemsReturn<T> {
  const [overrides, setOverrides] =
    useState<ReadonlyMap<string, boolean>>(NO_OVERRIDES);

  // Rows are copied only where the user's choice differs from the seed, so an
  // untouched list is passed straight through by reference.
  const items =
    overrides.size === 0
      ? initialItems
      : initialItems.map(item => {
          const chosen = overrides.get(item.id);
          return chosen === undefined || chosen === item.selected
            ? item
            : ({ ...item, selected: chosen } as T);
        });

  const selectedItems = items.filter(item => item.selected);
  const isMaxReached =
    maxSelection !== undefined && selectedItems.length >= maxSelection;

  const toggleItem = (itemId: string) => {
    const target = items.find(item => item.id === itemId);

    // If item not found, return unchanged
    if (!target) {
      return;
    }

    // If trying to select but max is reached, prevent selection
    if (!target.selected && isMaxReached) {
      logger.warn(`Maximum selection of ${maxSelection} items reached`);
      return;
    }

    setOverrides(prev => {
      const next = new Map(prev);
      next.set(itemId, !target.selected);
      return next;
    });
  };

  const clearSelection = () => {
    setOverrides(() => {
      const next = new Map<string, boolean>();
      for (const item of initialItems) {
        next.set(item.id, false);
      }
      return next;
    });
  };

  return {
    items,
    selectedItems,
    toggleItem,
    isMaxReached,
    clearSelection,
  };
}
