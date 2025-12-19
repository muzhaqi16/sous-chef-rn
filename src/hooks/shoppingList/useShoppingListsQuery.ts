import { useMemo, useCallback } from 'react';
import { useAppNavigation } from '#hooks';
import { useGetShoppingListsQuery, GetShoppingListsQuery } from '#generated';

// Extract the shopping list type from the query
export type ShoppingListFromQuery = GetShoppingListsQuery['shoppingLists'][number];

/**
 * useShoppingListsQuery - Query shopping lists with smart caching
 *
 * Single responsibility:
 * - Fetch all user's shopping lists (independent of home)
 * - Use cache-and-network for best UX (instant cache display + fresh data)
 * - Provide fetchLists() for manual refresh (e.g., when selector opens)
 * - Provide stable lists array with fallback to previous data
 *
 * PERFORMANCE: Uses hardcoded fetchPolicy to prevent query cascade.
 * - cache-and-network: Shows cached data immediately, fetches fresh in background
 * - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders
 * - No homeId: shopping lists are independent of homes
 * - Offline: errorPolicy returns cached data when network fails
 *
 * Note: This is different from useShoppingListQuery which fetches items for a single list.
 * This hook fetches the list of shopping lists.
 */
export function useShoppingListsQuery() {
  const { isFocused } = useAppNavigation();

  // PERFORMANCE: Hardcoded policy prevents cascade from network status changes
  // - cache-and-network: Shows cached data immediately, fetches fresh in background
  // - nextFetchPolicy: Prevents re-fetches on subsequent renders/list switches
  // - No homeId: shopping lists are independent of homes
  const { data, previousData, loading, error, refetch } =
    useGetShoppingListsQuery({
      variables: {},
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
      errorPolicy: 'all',
    });

  // Function to trigger fresh fetch - call when selector opens for latest data
  const fetchLists = useCallback(() => {
    refetch();
  }, [refetch]);

  // Stable lists array with fallback to previous data (graceful degradation on network error)
  const lists = useMemo(
    (): ShoppingListFromQuery[] =>
      data?.shoppingLists ?? previousData?.shoppingLists ?? [],
    [data?.shoppingLists, previousData?.shoppingLists],
  );

  return {
    lists,
    loading,
    error,
    refetch,
    fetchLists, // Call this when selector opens to trigger fresh fetch
    isFocused,
  };
}
