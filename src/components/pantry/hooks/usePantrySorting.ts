import { useState } from 'react';
import type { SortOption, SortDirection } from '../PantryContent';

// Item type for sorting (minimal interface)
interface SortableItem {
  id: string;
  itemName?: string | null;
  expiresAt?: string | null;
  quantity: number;
  createdAt?: string;
}

interface UsePantrySortingOptions {
  /** Initial sort option from preferences */
  initialSortOption?: SortOption;
  /** Initial sort direction from preferences */
  initialSortDirection?: SortDirection;
  /** Callback to persist sort changes to store */
  onSortChange?: (option: SortOption, direction: SortDirection) => void;
}

interface UsePantrySortingResult<T extends SortableItem> {
  /** Current sort option */
  sortOption: SortOption;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Whether sort modal is visible */
  sortModalVisible: boolean;
  /** Open the sort modal */
  openSortModal: () => void;
  /** Close the sort modal */
  closeSortModal: () => void;
  /** Handle sort option selection */
  handleSortSelect: (option: SortOption) => void;
  /** Sort items according to current settings */
  sortItems: (items: T[]) => T[];
}

/**
 * usePantrySorting - Hook for managing pantry item sorting
 *
 * Encapsulates:
 * - Sort state (option and direction)
 * - Modal visibility state
 * - Sorting logic
 * - Persistence callbacks
 *
 * @example
 * ```tsx
 * const {
 *   sortOption,
 *   sortDirection,
 *   sortModalVisible,
 *   openSortModal,
 *   closeSortModal,
 *   handleSortSelect,
 *   sortItems,
 * } = usePantrySorting({
 *   initialSortOption: 'recent',
 *   initialSortDirection: 'desc',
 *   onSortChange: persistToStore,
 * });
 *
 * const sortedItems = sortItems(items);
 * ```
 */
export function usePantrySorting<T extends SortableItem>(
  options: UsePantrySortingOptions = {},
): UsePantrySortingResult<T> {
  const {
    initialSortOption = 'recent',
    initialSortDirection = 'desc',
    onSortChange } = options;

  // Sort state (local, initialized from props)
  const [sortOption, setSortOption] = useState<SortOption>(initialSortOption);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Modal controls
  const openSortModal = () => {
    setSortModalVisible(true);
  };

  const closeSortModal = () => {
    setSortModalVisible(false);
  };

  // Handle sort option selection
  const handleSortSelect = (option: SortOption) => {
      let newOption = sortOption;
      let newDirection = sortDirection;

      if (sortOption === option) {
        // Toggle direction if same option selected
        newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        setSortDirection(newDirection);
      } else {
        // Set new option and reset to ascending
        newOption = option;
        newDirection = 'asc';
        setSortOption(newOption);
        setSortDirection(newDirection);
      }

      // Persist to store
      onSortChange?.(newOption, newDirection);
      setSortModalVisible(false);
    };

  // Sort function - optimized: single shallow copy sorted in-place with a Map lookup
  const sortItems = (items: T[]): T[] => {
      // Pre-compute timestamps into a Map (O(n)) instead of wrapping each item
      const expiryMap = new Map<string, number>();
      const createdMap = new Map<string, number>();
      for (const item of items) {
        if (sortOption === 'expiry') {
          expiryMap.set(item.id, item.expiresAt ? new Date(item.expiresAt).getTime() : Infinity);
        } else if (sortOption === 'recent') {
          createdMap.set(item.id, item.createdAt ? new Date(item.createdAt).getTime() : 0);
        }
      }

      // Single shallow copy, sorted in-place — no wrapper objects, no final .map()
      const sorted = items.slice();
      sorted.sort((a, b) => {
        let comparison = 0;
        switch (sortOption) {
          case 'name':
            comparison = (a.itemName || '').localeCompare(b.itemName || '');
            break;
          case 'expiry':
            comparison = expiryMap.get(a.id)! - expiryMap.get(b.id)!;
            break;
          case 'quantity':
            comparison = a.quantity - b.quantity;
            break;
          case 'recent':
            comparison = createdMap.get(b.id)! - createdMap.get(a.id)!;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });

      return sorted;
    };

  return {
    sortOption,
    sortDirection,
    sortModalVisible,
    openSortModal,
    closeSortModal,
    handleSortSelect,
    sortItems };
}
