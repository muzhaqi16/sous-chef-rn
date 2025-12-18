import { useMemo, useCallback } from 'react';
import { useAppNavigation } from '#hooks';
import { useGetShoppingListsQuery, GetShoppingListsQuery } from '#generated';
import { useOfflinePresetPolicy } from '#/apollo/policies/offlineFetchPolicies';

// Extract the shopping list type from the query
export type ShoppingListFromQuery = GetShoppingListsQuery['shoppingLists'][number];

/**
 * useShoppingListsQuery - Query shopping lists with smart caching
 *
 * Single responsibility:
 * - Fetch all user's shopping lists (independent of home)
 * - Use DETAIL preset (cache-first online, cache-only offline) to prevent re-fetch on list switch
 * - Provide fetchLists() for manual refresh (e.g., when selector opens)
 * - Provide stable lists array with fallback to previous data
 *
 * PERFORMANCE: Uses DETAIL preset to prevent re-fetching when switching between lists.
 * Shopping lists are independent of homes - no homeId dependency prevents cascade.
 * Offline-aware: switches to cache-only when offline to prevent network errors.
 *
 * Note: This is different from useShoppingListQuery which fetches items for a single list.
 * This hook fetches the list of shopping lists.
 */
export function useShoppingListsQuery() {
  const { isFocused } = useAppNavigation();

  // PERFORMANCE: DETAIL preset (cache-first online, cache-only offline)
  // - First visit: fetches from network (cache empty)
  // - Subsequent visits/list switches: uses cache (no network request)
  // - Offline: uses cache-only to prevent network errors
  // - No homeId: shopping lists are independent of homes
  const fetchPolicy = useOfflinePresetPolicy('DETAIL');

  const { data, previousData, loading, error, refetch } =
    useGetShoppingListsQuery({
      variables: {},
      fetchPolicy,
      nextFetchPolicy: 'cache-first', // Maintain cache-first after initial fetch
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
