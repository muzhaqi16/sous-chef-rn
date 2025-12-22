import { useMemo, useCallback } from 'react';
import { useGetShoppingListsLiteQuery, GetShoppingListsLiteQuery } from '#generated';

// Extract the shopping list type from the lite query (metadata only)
export type ShoppingListFromQuery = GetShoppingListsLiteQuery['shoppingLists'][number];

/**
 * useShoppingListsQuery - Query shopping lists with smart caching (LIGHTWEIGHT)
 *
 * Single responsibility:
 * - Fetch all user's shopping lists METADATA ONLY (no items, no collaborators)
 * - Use cache-and-network for best UX (instant cache display + fresh data)
 * - Provide fetchLists() for manual refresh (e.g., when selector opens)
 * - Provide stable lists array with fallback to previous data
 *
 * PERFORMANCE: Uses GetShoppingListsLite query to reduce API complexity.
 * - Only fetches list metadata (id, name, totalItems, etc.)
 * - NO itemsConnection (items fetched via GetShoppingList for current list)
 * - NO collaboratorsConnection (permissions fetched via GetShoppingList)
 * - NO home.membersConnection/myMembership (fetched via GetShoppingList)
 *
 * Note: For detailed list data (items, permissions, collaborators), use
 * useShoppingListDetailQuery with the current list ID.
 */
export function useShoppingListsQuery() {
  // PERFORMANCE: Uses lightweight query - metadata only, no items/collaborators
  // - cache-and-network: Shows cached data immediately, fetches fresh in background
  // - nextFetchPolicy: Prevents re-fetches on subsequent renders/list switches
  // - No homeId: shopping lists are independent of homes
  const { data, previousData, loading, error, refetch } =
    useGetShoppingListsLiteQuery({
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
  };
}
