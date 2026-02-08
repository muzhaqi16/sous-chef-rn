/**
 * usePantryQuery - Query hook for fetching pantry data
 *
 * Single responsibility:
 * - Fetch pantry with items
 * - Normalize data structure
 * - Handle pagination
 * - Preserve data during failures
 */

import { useMemo, useCallback, useState } from 'react';
import { useGetPantryQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { normalizePantry } from '#/utils/connectionUtils';
import { usePagination } from '#/hooks/utils/usePagination';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';
import { useSearchableList } from '../../useSearchableList';
import { pantryItemSearch } from '#/utils/searchUtils';
import { useAppStore, selectIsHomeSelectionReady } from '#store/useAppStore';

/**
 * Hook for fetching and managing pantry query with pagination
 *
 * PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
 * - cache-and-network: Shows cached data immediately, fetches fresh in background
 * - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders
 * - errorPolicy: 'ignore' returns cached data when network fails
 *
 * @example
 * ```tsx
 * const { pantryItems, loading, loadMore, hasMore, searchQuery, setSearchQuery } =
 *   usePantryQuery(pantryId);
 * ```
 */
export function usePantryQuery(pantryId: string | undefined) {
  const { isLoggedOut } = useAuth();
  const isHomeSelectionReady = useAppStore(selectIsHomeSelectionReady);

  // Explicit validation - only execute query when pantryId is genuinely valid
  // Gate on isHomeSelectionReady to prevent queries with stale IDs after home deletion
  const hasValidPantryId = !!pantryId?.trim() && !isLoggedOut && isHomeSelectionReady;

  const { data, loading, error, refetch, fetchMore } = useGetPantryQuery({
    variables: {
      id: pantryId || '',
      itemsFirst: 25, // Initial page size
      storageLocationsFirst: 50,
    },
    skip: !hasValidPantryId,
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    // PERF: Removed notifyOnNetworkStatusChange to eliminate 2 extra re-renders
    // per mount (loading→ready transitions). Manual isRefreshing tracks pull-to-refresh instead.
    errorPolicy: 'ignore', // Return cached data on network errors
  });

  // Track pull-to-refresh state manually (replaces notifyOnNetworkStatusChange)
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Normalize pantry data to flatten Connection pattern
  const normalizedPantry = useMemo(
    () => normalizePantry(data?.pantry),
    [data?.pantry],
  );

  // Preserve pantry items across network failures
  const preservedItems = usePreservedArrayData(normalizedPantry?.items);

  // Filter out items that are pending deletion to prevent flicker
  const pantryItems = useMemo(
    () => subscriptionService.filterPendingDeletes(preservedItems),
    [preservedItems],
  );

  // Search functionality
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    filtered: filteredItems,
  } = useSearchableList(pantryItems, pantryItemSearch);

  // Pagination using generic utility hook
  const { hasMore, loadMore, isLoadingMore } = usePagination({
    pageInfo: normalizedPantry?.itemsPageInfo,
    loading,
    itemCount: pantryItems.length,
    fetchMore,
    fetchMoreVariables: { id: pantryId },
    cursorVariableName: 'itemsCursor',
  });

  // Wrap refetch to track pull-to-refresh state
  const memoizedRefetch = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

  return {
    pantryItems,
    filteredItems,
    normalizedPantry,
    loading,
    isRefreshing,
    error,
    refetch: memoizedRefetch,

    // Pagination
    hasMore,
    loadMore,
    isLoadingMore,

    // Search
    searchQuery,
    setSearchQuery,
  };
}
