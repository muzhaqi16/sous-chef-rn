import { useState, useCallback } from 'react';
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
 * const sortedItems = useMemo(() => sortItems(items), [items, sortItems]);
 * ```
 */
export function usePantrySorting<T extends SortableItem>(
  options: UsePantrySortingOptions = {},
): UsePantrySortingResult<T> {
  const {
    initialSortOption = 'recent',
    initialSortDirection = 'desc',
    onSortChange,
  } = options;

  // Sort state (local, initialized from props)
  const [sortOption, setSortOption] = useState<SortOption>(initialSortOption);
  const [sortDirection, setSortDirection] =
    useState<SortDirection>(initialSortDirection);
  const [sortModalVisible, setSortModalVisible] = useState(false);

  // Modal controls
  const openSortModal = useCallback(() => {
    setSortModalVisible(true);
  }, []);

  const closeSortModal = useCallback(() => {
    setSortModalVisible(false);
  }, []);

  // Handle sort option selection
  const handleSortSelect = useCallback(
    (option: SortOption) => {
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
    },
    [sortOption, sortDirection, onSortChange],
  );

  // Sort function - optimized with pre-computed timestamps
  const sortItems = useCallback(
    (items: T[]): T[] => {
      // Pre-compute timestamps once (O(n)) instead of inside comparator (O(n log n))
      const itemsWithTs = items.map(item => ({
        item,
        expiryTs: item.expiresAt ? new Date(item.expiresAt).getTime() : Infinity,
        createdTs: item.createdAt ? new Date(item.createdAt).getTime() : 0,
      }));

      // Sort using pre-computed values (no Date creation in comparator)
      itemsWithTs.sort((a, b) => {
        let comparison = 0;
        switch (sortOption) {
          case 'name':
            comparison = (a.item.itemName || '').localeCompare(
              b.item.itemName || '',
            );
            break;
          case 'expiry':
            comparison = a.expiryTs - b.expiryTs;
            break;
          case 'quantity':
            comparison = a.item.quantity - b.item.quantity;
            break;
          case 'recent':
            comparison = b.createdTs - a.createdTs;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });

      return itemsWithTs.map(({ item }) => item);
    },
    [sortOption, sortDirection],
  );

  return {
    sortOption,
    sortDirection,
    sortModalVisible,
    openSortModal,
    closeSortModal,
    handleSortSelect,
    sortItems,
  };
}
