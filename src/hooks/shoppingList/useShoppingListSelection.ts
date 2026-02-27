import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore, selectShoppingListState } from '#store/useAppStore';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';

/**
 * useShoppingListSelection - Shopping list selection
 *
 * Shows all shopping lists (no home-based filtering).
 * Grouping by home is handled in the UI layer (selector modal).
 *
 * Auto-selects first list when no valid selection exists.
 */
export function useShoppingListSelection(lists: ShoppingListFromQuery[]) {
  const { selectedShoppingListId, setSelectedShoppingListId } = useAppStore(
    useShallow(selectShoppingListState),
  );

  // Show all lists - grouping by home is handled in the UI layer
  const relevantLists = lists;

  // Default: first with isDefault flag from relevant lists, or first relevant list
  const defaultList = relevantLists.find(list => list.isDefault) || relevantLists[0];

  // Derive currentListId: use selected if valid, otherwise use default
  const currentListId = (() => {
    if (
      selectedShoppingListId &&
      relevantLists.some(l => l.id === selectedShoppingListId)
    ) {
      return selectedShoppingListId;
    }
    return defaultList?.id;
  })();

  // Current list object
  const currentList = relevantLists.find(list => list.id === currentListId) || defaultList;

  // Auto-select when lists load and current selection is invalid
  useEffect(() => {
    // Skip if no lists available yet (query still loading)
    if (relevantLists.length === 0) return;

    // Check if current selection is valid
    const hasValidSelection =
      selectedShoppingListId &&
      relevantLists.some(l => l.id === selectedShoppingListId);

    // Skip if already have valid selection
    if (hasValidSelection) return;

    // Auto-select: first with isDefault flag, or first list
    const listToSelect =
      relevantLists.find(l => l.isDefault) || relevantLists[0];
    if (listToSelect?.id) {
      setSelectedShoppingListId(listToSelect.id);
    }
  }, [relevantLists, selectedShoppingListId, setSelectedShoppingListId]);

  return {
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  };
}
