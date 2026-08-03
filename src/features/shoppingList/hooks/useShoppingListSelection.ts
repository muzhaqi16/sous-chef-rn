import { useEffect, useState } from 'react';
import { useShoppingListState } from '#store/useAppStore';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';

const EMPTY_DENIED: ReadonlySet<string> = new Set();

/**
 * useShoppingListSelection - Centralized shopping list selection
 *
 * Shows all shopping lists (no home-based filtering).
 * Grouping by home is handled in the UI layer (selector modal).
 *
 * Handles:
 * - Auto-selecting a default list when selection is null
 * - Pending selections: when the user switches to a newly created list that
 *   hasn't appeared in query results yet, the auto-select is suppressed
 * - Stale detection: when a list is removed (subscription/deletion), auto-select fires
 * - Denied lists: ids the caller knows the user can no longer access (a read
 *   returned FORBIDDEN, or null data for a deleted/unshared list) are
 *   excluded from selection so auto-select never re-picks a dead list while its
 *   cache entry lingers.
 *
 * Deletion callers should set selectedShoppingListId to null — auto-select handles the rest.
 */
export function useShoppingListSelection(
  allLists: ShoppingListFromQuery[],
  deniedListIds: ReadonlySet<string> = EMPTY_DENIED,
) {
  const { selectedShoppingListId, setSelectedShoppingListId } =
    useShoppingListState();

  // Exclude lists the user has lost access to but whose cache entry hasn't been
  // dropped from the lite query yet. Skip the filter allocation when none denied.
  const lists = deniedListIds.size
    ? allLists.filter(l => !deniedListIds.has(l.id))
    : allLists;

  // Default: first with isDefault flag, or first list
  const defaultList = lists.find(list => list.isDefault) || lists[0];

  const isInLists =
    !!selectedShoppingListId &&
    lists.some(l => l.id === selectedShoppingListId);

  // --- Pending selection tracking ---
  // When the user explicitly switches from one list to another (e.g., creates a new
  // list), the target may not be in query results yet. We track this as "pending" so
  // the auto-select effect doesn't override it.
  // Uses "adjusting state during render" pattern per project conventions.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState(selectedShoppingListId);

  if (selectedShoppingListId !== prevSelectedId) {
    setPrevSelectedId(selectedShoppingListId);
    // Only mark pending for explicit list switches (non-null → non-null, target not
    // yet in results). Null → non-null (hydration/bootstrap) and anything → null
    // (deletion) are NOT pending, preserving stale-ID correction and auto-select.
    if (
      prevSelectedId !== null &&
      selectedShoppingListId !== null &&
      !lists.some(l => l.id === selectedShoppingListId)
    ) {
      setPendingId(selectedShoppingListId);
    } else {
      setPendingId(null);
    }
  }

  // Clear pending when the target list appears in query results
  if (pendingId && lists.some(l => l.id === pendingId)) {
    setPendingId(null);
  }

  // Derive currentListId: use selected if valid, otherwise use default
  const currentListId = isInLists ? selectedShoppingListId : defaultList?.id;

  // Current list object
  const currentList =
    lists.find(list => list.id === currentListId) || defaultList;

  // Auto-select when lists load and current selection is invalid
  useEffect(() => {
    if (lists.length === 0) return;

    // Don't override a pending user selection — the cache hasn't caught up yet
    if (pendingId) return;

    const hasValidSelection =
      selectedShoppingListId &&
      lists.some(l => l.id === selectedShoppingListId);
    if (hasValidSelection) return;

    const listToSelect = lists.find(l => l.isDefault) || lists[0];
    if (listToSelect?.id) {
      setSelectedShoppingListId(listToSelect.id);
    }
  }, [lists, selectedShoppingListId, pendingId, setSelectedShoppingListId]);

  // PERF: Trust persisted Zustand ID for queries before lists finish loading.
  // This breaks the query waterfall: detail/items queries fire immediately
  // instead of waiting for GetShoppingListsLite to resolve first.
  // If the ID is stale (list was deleted), the detail query returns null
  // and we fall back to the default list reactively via the auto-select effect.
  const optimisticListId = selectedShoppingListId ?? currentListId;

  return {
    optimisticListId,
    currentListId,
    currentList,
    defaultList,
    selectedShoppingListId,
    setSelectedShoppingListId,
  };
}
