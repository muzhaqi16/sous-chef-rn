/**
 * useHomeQuery - Query hook for fetching user's homes
 *
 * Single responsibility:
 * - Fetch homes with cache-and-network policy
 * - Preserve data during failures
 * - Compute statistics
 */

import { useState } from 'react';
import { useGetHomesQuery } from '#generated';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';
import { normalizeHomes, extractNodes } from '#/utils/connectionUtils';

/**
 * Hook for fetching and managing homes query
 *
 * PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
 * - cache-and-network: Shows cached data immediately, fetches fresh in background
 * - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders
 * - errorPolicy: 'ignore' returns cached data when network fails (offline graceful degradation)
 *
 * @example
 * ```tsx
 * const { homes, loading, stats, refetch } = useHomeQuery();
 * ```
 */
export function useHomeQuery() {
  const { data, loading, error, refetch } = useGetHomesQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'ignore',
  });

  // Preserve homes even when query fails to prevent cascade failures
  // Extract nodes from connection type (homes returns HomeConnection)
  const preservedHomes = usePreservedArrayData(extractNodes(data?.homes));
  const homes = normalizeHomes(preservedHomes);

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = preservedHomes?.find((h: any) => h.isDefault)?.id ?? null;

  // Track the last known pantries count to avoid flickering to 0 during refetch
  const [lastKnownPantriesCount, setLastKnownPantriesCount] = useState<number>(0);

  // Statistics and computed values
  const validHomes = Array.isArray(homes) ? homes.filter(Boolean) : [];

  // Check if all homes have loaded their pantries data
  const allHomesLoaded = validHomes.every(
    (home: any) => home.pantries !== null,
  );

  let totalPantries: number;

  if (allHomesLoaded) {
    // Use totalCount from the server for accurate counts, fall back to array length
    totalPantries = validHomes.reduce((acc, home: any) => {
      const count = home?.pantriesTotalCount ?? (Array.isArray(home?.pantries) ? home.pantries.length : 0);
      return acc + count;
    }, 0);
    // Update our last known count (only if changed to avoid extra re-renders)
    if (totalPantries !== lastKnownPantriesCount) {
      setLastKnownPantriesCount(totalPantries);
    }
  } else {
    // Some data is still loading, use the last known count to prevent flickering
    totalPantries = lastKnownPantriesCount;
  }

  const stats = {
    totalHomes: validHomes.length,
    totalMembers: validHomes.reduce((acc, home: any) => {
      const count = home?.membersTotalCount ?? (Array.isArray(home?.members) ? home.members.length : 0);
      return acc + count;
    }, 0),
    totalPantries,
  };

  // Memoize the refetch function to prevent unnecessary re-renders
  const memoizedRefetch = async () => {
    await refetch();
  };

  return {
    homes,
    preservedHomes,
    remoteDefaultHomeId,
    loading,
    initialLoading: !homes && loading,
    error,
    stats,
    refetch: memoizedRefetch,
  };
}
