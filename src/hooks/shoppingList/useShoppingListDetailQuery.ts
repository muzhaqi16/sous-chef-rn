import { useMemo, useRef, useEffect } from 'react';
import { useGetShoppingListQuery, GetShoppingListQuery } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';

// Export the shopping list type from the detail query
export type ShoppingListDetail = NonNullable<GetShoppingListQuery['shoppingList']>;

/**
 * useShoppingListDetailQuery - Query detailed shopping list data
 *
 * Single responsibility:
 * - Fetch full details for a specific shopping list (items, collaborators, permissions)
 * - Handle offline-aware fetch policy
 * - Sort items by sortOrder (for fractional indexing support)
 * - Provide stable items array with fallback to previous data
 *
 * Use this hook when you need:
 * - Items for the current list
 * - Collaborator data for permissions
 * - Home membership data for home-linked lists
 *
 * Note: For list metadata only (list selector), use useShoppingListsQuery.
 */
export function useShoppingListDetailQuery(listId: string | null | undefined) {
  const { isLoggedOut } = useAuth();

  const shouldSkip = !listId || isLoggedOut;

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-and-network: Shows cached data immediately, fetches fresh in background
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders/tab switches
  // - errorPolicy: 'all' returns cached data when network fails (offline graceful degradation)
  const { data, previousData, loading, error, refetch } =
    useGetShoppingListQuery({
      variables: {
        id: listId ?? '',
      },
      skip: shouldSkip,
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'all',
    });

  // Track previous listId to detect list switches
  // When switching lists, we should NOT fall back to previousData (it's from old list)
  const previousListIdRef = useRef<string | null | undefined>(listId);
  const listIdChanged = previousListIdRef.current !== listId;

  // Update ref after comparison (in effect to avoid changing during render)
  useEffect(() => {
    previousListIdRef.current = listId;
  }, [listId]);

  // OPTIMIZATION: Extract items from itemsConnection edges and sort by sortOrder
  // Sorting client-side ensures subscription updates to sortOrder are reflected in UI
  // Apollo's cached Connection order doesn't change when item fields are updated
  // NOTE: Only use previousData fallback if same list (prevents flash on list switch)
  const items = useMemo((): ShoppingListItemDisplayFragment[] => {
    // If list changed, don't fall back to previousData (it contains old list's items)
    const edges = listIdChanged
      ? data?.shoppingList?.itemsConnection?.edges ?? []
      : data?.shoppingList?.itemsConnection?.edges ??
        previousData?.shoppingList?.itemsConnection?.edges ??
        [];
    return edges
      .map(edge => edge.node)
      .sort((a, b) => {
        // Sort by sortOrder (string comparison for fractional indexing)
        const sortA = a.sortOrder ?? 'zzz';
        const sortB = b.sortOrder ?? 'zzz';
        return sortA.localeCompare(sortB);
      });
  }, [
    listIdChanged,
    data?.shoppingList?.itemsConnection?.edges,
    previousData?.shoppingList?.itemsConnection?.edges,
  ]);

  // Extract the shopping list detail (with previousData fallback for same list)
  const shoppingList = useMemo((): ShoppingListDetail | null => {
    if (listIdChanged) {
      return data?.shoppingList ?? null;
    }
    return data?.shoppingList ?? previousData?.shoppingList ?? null;
  }, [listIdChanged, data?.shoppingList, previousData?.shoppingList]);

  return {
    // Full shopping list data (for permissions, collaborators, etc.)
    shoppingList,
    // Extracted and sorted items
    items,
    loading,
    error,
    refetch,
  };
}
