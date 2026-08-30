import { useEffect, useState } from 'react';
import { useShoppingListState } from '#store/useAppStore';
import type { ShoppingListFromQuery } from './useShoppingListsQuery';

const EMPTY_DENIED: ReadonlySet<string> = new Set();

/**
 * Selection over ALL the user's lists; grouping by home is the selector modal's
 * job. Auto-select fills a null selection (so a delete just sets the id to
 * null); a PENDING id — created but not yet in query results — suppresses it,
 * and a DENIED id (FORBIDDEN read, or null data) is excluded for good.
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

  const defaultList = lists.find(list => list.isDefault) || lists[0];

  const isInLists =
    !!selectedShoppingListId &&
    lists.some(l => l.id === selectedShoppingListId);

  // An explicit switch (creating a list, say) can target a list the query results
  // do not hold yet; tracking it as pending stops auto-select overriding it.
  // Adjusting state during render, not an effect.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [prevSelectedId, setPrevSelectedId] = useState(selectedShoppingListId);

  if (selectedShoppingListId !== prevSelectedId) {
    setPrevSelectedId(selectedShoppingListId);
    // Only non-null → non-null is a switch. Null → non-null (hydration) and
    // anything → null (deletion) must stay non-pending, or stale-id correction
    // and auto-select never run.
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

  const currentListId = isInLists ? selectedShoppingListId : defaultList?.id;

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

  // The persisted id is trusted before the lists load, so the detail/items
  // queries need not wait on GetShoppingListsLite. A stale id reads as null data
  // and the auto-select effect falls back to the default list.
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
