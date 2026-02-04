/**
 * useHomeQuery - Query hook for fetching user's homes
 *
 * Single responsibility:
 * - Fetch homes with cache-and-network policy
 * - Preserve data during failures
 * - Compute statistics
 */

import { useMemo, useRef, useCallback } from 'react';
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
  const homes = useMemo(() => normalizeHomes(preservedHomes), [preservedHomes]);

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = useMemo(
    () => preservedHomes?.find((h: any) => h.isDefault)?.id ?? null,
    [preservedHomes],
  );

  // Track the last known pantries count to avoid flickering to 0 during refetch
  const lastKnownPantriesCount = useRef<number>(0);

  // Statistics and computed values
  const stats = useMemo(() => {
    const validHomes = Array.isArray(homes) ? homes.filter(Boolean) : [];

    // Check if all homes have loaded their pantries data
    const allHomesLoaded = validHomes.every(
      (home: any) => home.pantries !== null,
    );

    let totalPantries: number;

    if (allHomesLoaded) {
      // All data is loaded, calculate the actual count
      totalPantries = validHomes.reduce((acc, home: any) => {
        const count = Array.isArray(home?.pantries) ? home.pantries.length : 0;
        return acc + count;
      }, 0);
      // Update our last known count
      lastKnownPantriesCount.current = totalPantries;
    } else {
      // Some data is still loading, use the last known count to prevent flickering
      totalPantries = lastKnownPantriesCount.current;
    }

    return {
      totalHomes: validHomes.length,
      totalMembers: validHomes.reduce((acc, home: any) => {
        const count = Array.isArray(home?.members) ? home.members.length : 0;
        return acc + count;
      }, 0),
      totalPantries,
    };
  }, [homes]);

  // Memoize the refetch function to prevent unnecessary re-renders
  const memoizedRefetch = useCallback(async () => {
    await refetch();
  }, [refetch]);

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
