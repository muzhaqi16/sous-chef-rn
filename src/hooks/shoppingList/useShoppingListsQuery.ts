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
 * - Use cache-first policy (fetches only if cache empty, no re-fetch on list switch)
 * - Provide fetchLists() for manual refresh (e.g., when selector opens)
 * - Provide stable lists array with fallback to previous data
 *
 * PERFORMANCE: Uses cache-first to prevent re-fetching when switching between lists.
 * Shopping lists are independent of homes - no homeId dependency prevents cascade.
 *
 * Note: This is different from useShoppingListQuery which fetches items for a single list.
 * This hook fetches the list of shopping lists.
 */
export function useShoppingListsQuery() {
  const { isFocused } = useAppNavigation();

  // PERFORMANCE: cache-first fetches only if cache is empty
  // - First visit: fetches from network (cache empty)
  // - Subsequent visits/list switches: uses cache (no network request)
  // - nextFetchPolicy maintains cache-first after initial fetch
  // - No homeId: shopping lists are independent of homes
  const { data, previousData, loading, error, refetch } =
    useGetShoppingListsQuery({
      variables: {},
      fetchPolicy: 'cache-first',
      nextFetchPolicy: 'cache-first', // Prevent Apollo from switching policies
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
