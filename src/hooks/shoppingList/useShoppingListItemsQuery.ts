import { useMemo, useRef, useEffect } from 'react';
import { useGetShoppingListQuery } from '#generated';
import type { ShoppingListItemDisplayFragment } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';

/**
 * useShoppingListItemsQuery - Query shopping list items with focus-aware fetching
 *
 * Single responsibility:
 * - Fetch items for a specific shopping list
 * - Handle offline-aware fetch policy
 * - Sort items by sortOrder (for fractional indexing support)
 * - Provide stable items array with fallback to previous data
 *
 * This hook is consumed by useShoppingListManagement for data orchestration.
 */
export function useShoppingListItemsQuery(listId: string | null | undefined) {
  const { isLoggedOut } = useAuth();

  const shouldSkip = !listId || isLoggedOut;

  // PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
  // - cache-first: Uses cache if available, prevents duplicate fetches on navigation
  // - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders/tab switches
  // - errorPolicy: 'all' returns cached data when network fails (offline graceful degradation)
  // Note: Pull-to-refresh uses explicit refetch() for fresh data

  // Watch cache for updates from mutations and subscriptions
  // Uses GetShoppingList with itemsConnection as single source of truth
  // PERFORMANCE: Include previousData to prevent UI flash during refetch
  const { data, previousData, loading, error, refetch } =
    useGetShoppingListQuery({
      variables: {
        id: listId ?? '',
      },
      skip: shouldSkip,
      fetchPolicy: 'cache-first',
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

  return {
    items,
    loading,
    error,
    refetch,
  };
}
