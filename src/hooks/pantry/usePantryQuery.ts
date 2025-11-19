import { useMemo } from 'react';
import { useGetPantryQuery } from '#generated';
import { useAuth } from '#hooks/auth/useAuth';
import { normalizePantry } from '#/utils/connectionUtils';

/**
 * Hook for querying pantry items with Connection-based pagination
 * Handles data fetching, normalization, and offline behavior
 */
export function usePantryQuery(pantryId: string | undefined) {
  const { isLoggedOut } = useAuth();

  // Explicit validation - only execute query when pantryId is genuinely valid
  const hasValidPantryId = !!pantryId?.trim() && !isLoggedOut;

  // Single source of truth: Apollo cache - Connection-based query
  const { data, loading, error, refetch, fetchMore } = useGetPantryQuery({
    variables: hasValidPantryId ? {
      id: pantryId,
      itemsFirst: 25, // Initial page size
      storageLocationsFirst: 50,
    } : undefined as any,
    skip: !hasValidPantryId, // Query only executes when pantryId is valid
    fetchPolicy: 'cache-and-network', // Show cache immediately, then fetch fresh data
    notifyOnNetworkStatusChange: true,
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Real-time updates via subscription are now handled by SubscriptionProvider
  // This provides automatic deduplication, error handling, and consistent logging
  // across all subscriptions. Apollo automatically updates the cache via normalization.

  // Normalize pantry data to flatten Connection pattern and preserve pagination metadata
  const normalizedPantry = useMemo(
    () => normalizePantry(data?.pantry),
    [data?.pantry],
  );

  const items = useMemo(
    () => normalizedPantry?.items || [],
    [normalizedPantry],
  );

  return {
    items,
    pageInfo: normalizedPantry?.itemsPageInfo,
    loading,
    error,
    refetch,
    fetchMore,
  };
}
