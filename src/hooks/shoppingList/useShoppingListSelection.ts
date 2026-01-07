import { useMemo, useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  useAppStore,
  selectShoppingListState,
  selectSelectedHomeId,
} from '#store/useAppStore';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';

/**
 * useShoppingListSelection - Simple list selection with home context
 *
 * Filters lists to show:
 * - Lists belonging to current selected home
 * - Personal lists (no home)
 * - Shared lists without a home
 *
 * Uses one-time auto-select to prevent infinite re-render loops.
 */
export function useShoppingListSelection(lists: ShoppingListFromQuery[]) {
  const { selectedShoppingListId, setSelectedShoppingListId } = useAppStore(
    useShallow(selectShoppingListState),
  );
  const selectedHomeId = useAppStore(selectSelectedHomeId);

  // One-time initialization flag
  const didInitRef = useRef(false);

  // Filter lists relevant to current home context:
  // - Lists belonging to current home
  // - Personal lists (no home)
  // - Shared lists without a home
  const relevantLists = useMemo(() => {
    return lists.filter(
      list =>
        list.homeId === selectedHomeId || // Belongs to current home
        !list.homeId, // Personal or shared without home
    );
  }, [lists, selectedHomeId]);

  // Default: first with isDefault flag from relevant lists, or first relevant list
  const defaultList = useMemo(
    () => relevantLists.find(list => list.isDefault) || relevantLists[0],
    [relevantLists],
  );

  // Derive currentListId: use selected if valid, otherwise use default
  const currentListId = useMemo(() => {
    if (
      selectedShoppingListId &&
      relevantLists.some(l => l.id === selectedShoppingListId)
    ) {
      return selectedShoppingListId;
    }
    return defaultList?.id;
  }, [selectedShoppingListId, relevantLists, defaultList?.id]);

  // Current list object
  const currentList = useMemo(
    () => relevantLists.find(list => list.id === currentListId) || defaultList,
    [relevantLists, currentListId, defaultList],
  );

  // ONE-TIME auto-select
  useEffect(() => {
    if (didInitRef.current) return;
    if (relevantLists.length === 0) return;

    // Already have valid selection in relevant lists
    if (
      selectedShoppingListId &&
      relevantLists.some(l => l.id === selectedShoppingListId)
    ) {
      didInitRef.current = true;
      return;
    }

    // Select first relevant list
    const firstList = relevantLists.find(l => l.isDefault) || relevantLists[0];
    if (firstList?.id) {
      setSelectedShoppingListId(firstList.id);
    }
    didInitRef.current = true;
  }); // NO DEPENDENCIES - runs on every render until didInitRef is true

  return {
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  };
}
