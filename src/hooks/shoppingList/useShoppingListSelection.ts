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

  // Check if selected list still exists in the lists array
  const selectedListExists = useMemo(
    () =>
      selectedShoppingListId
        ? lists.some(list => list.id === selectedShoppingListId)
        : false,
    [selectedShoppingListId, lists],
  );

  // Derive: current list ID (only use selectedShoppingListId if it exists in lists)
  // This prevents querying deleted lists during race conditions after delete
  const currentListId = useMemo(() => {
    if (selectedShoppingListId && selectedListExists) {
      return selectedShoppingListId;
    }
    return defaultList?.id || undefined;
  }, [selectedShoppingListId, selectedListExists, defaultList?.id]);

  // Derive: current list object
  const currentList = useMemo(
    () => lists.find(list => list.id === currentListId) || defaultList,
    [lists, currentListId, defaultList],
  );

  // Auto-select: ONLY when no selection exists OR selected list was deleted
  // Key fix: Don't include defaultList?.id in dependencies - it changes on every lists update
  // Instead, calculate fallback list inside the effect to prevent infinite loops
  useEffect(() => {
    // Only auto-select if we have lists but no valid selection
    if (lists.length > 0 && (!selectedShoppingListId || !selectedListExists)) {
      const fallbackList = lists.find(list => list.isDefault) || lists[0];
      if (fallbackList?.id) {
        setSelectedShoppingListId(fallbackList.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShoppingListId, selectedListExists, lists.length]);
  // NOTE: Deliberately NOT including setSelectedShoppingListId, defaultList?.id or lists
  // to prevent infinite loop when lists change

  return {
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  };
}
