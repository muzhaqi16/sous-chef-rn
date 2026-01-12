import { useState, useCallback } from 'react';
import type { SortOption, SortDirection } from '../PantryContent';

// Item type for sorting (minimal interface)
interface SortableItem {
  id: string;
  expiresAt?: string | null;
  quantity: number;
  item?: {
    name?: string;
  } | null;
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

  // Sort function
  const sortItems = useCallback(
    (items: T[]): T[] => {
      const sorted = [...items].sort((a, b) => {
        let comparison = 0;
        switch (sortOption) {
          case 'name':
            comparison = (a.item?.name || '').localeCompare(b.item?.name || '');
            break;
          case 'expiry':
            const aExpiry = a.expiresAt
              ? new Date(a.expiresAt).getTime()
              : Infinity;
            const bExpiry = b.expiresAt
              ? new Date(b.expiresAt).getTime()
              : Infinity;
            comparison = aExpiry - bExpiry;
            break;
          case 'quantity':
            comparison = a.quantity - b.quantity;
            break;
          case 'recent':
            // Use createdAt if available
            comparison = a.createdAt && b.createdAt
              ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              : 0;
            break;
        }
        return sortDirection === 'asc' ? comparison : -comparison;
      });
      return sorted;
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
