import { useMemo, useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useAppStore,
  selectShoppingListState,
} from '#store/useAppStore';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';

/**
 * useShoppingListSelection - List selection with auto-select fallback
 *
 * Single responsibility:
 * - Manage which shopping list is currently selected
 * - Derive current list from selection or default
 * - Auto-select default list when no valid selection exists
 *
 * This hook is pure selection logic - no data fetching or transformation.
 */
export function useShoppingListSelection(lists: ShoppingListFromQuery[]) {
  // Use grouped selector with useShallow to prevent infinite loops (Zustand v5)
  const { selectedShoppingListId, setSelectedShoppingListId } = useAppStore(
    useShallow(selectShoppingListState),
  );

  // Derive: default list (first with isDefault flag, or first in array)
  const defaultList = useMemo(
    () => lists.find(list => list.isDefault) || lists[0] || undefined,
    [lists],
  );

  // Derive: current list ID (only use selectedShoppingListId if it exists in lists)
  // This prevents querying deleted lists during race conditions after delete
  const currentListId = useMemo(() => {
    // If there's a selection, verify it exists in the available lists
    if (selectedShoppingListId) {
      const exists = lists.some(list => list.id === selectedShoppingListId);
      if (exists) {
        return selectedShoppingListId;
      }
      // Selected list doesn't exist (was deleted) - fall through to default
    }
    // No valid selection - use default
    return defaultList?.id || undefined;
  }, [selectedShoppingListId, lists, defaultList?.id]);

  // Derive: current list object
  const currentList = useMemo(
    () => lists.find(list => list.id === currentListId) || defaultList,
    [lists, currentListId, defaultList],
  );

  // Check if selected list still exists in the lists array
  const selectedListExists = useMemo(
    () =>
      selectedShoppingListId
        ? lists.some(list => list.id === selectedShoppingListId)
        : false,
    [selectedShoppingListId, lists],
  );

  // Auto-select: when no list selected OR selected list no longer exists
  // Note: Synchronous update prevents duplicate query batches during initialization
  useEffect(() => {
    if (!selectedShoppingListId || !selectedListExists) {
      if (defaultList?.id) {
        setSelectedShoppingListId(defaultList.id);
      }
    }
  }, [
    selectedShoppingListId,
    selectedListExists,
    defaultList?.id,
    setSelectedShoppingListId,
  ]);

  return {
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  };
}
