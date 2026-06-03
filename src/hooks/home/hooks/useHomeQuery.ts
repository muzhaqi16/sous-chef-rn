/**
 * useHomeQuery - Query hook for fetching user's homes
 *
 * Single responsibility:
 * - Fetch homes with cache-and-network policy
 * - Preserve data during failures
 * - Compute statistics
 */

import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GetHomesDocument } from '#operations/home/home.generated';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import { getConnectionTotalCount } from '#/utils/connectionUtils';

/**
 * Hook for fetching and managing homes query
 *
 * PERFORMANCE: Hardcoded policies prevent query cascade from network status changes
 * - cache-and-network: Shows cached data immediately, fetches fresh in background
 * - nextFetchPolicy: 'cache-first' prevents re-fetches on subsequent renders
 * - errorPolicy: 'ignore' returns cached data when network fails (offline graceful degradation)
 *
 * Returns connection-shape home nodes (each carries `id`, `name`, `isDefault`,
 * `myMembership`, `pantriesConnection`, plus a masked `HomeCard_home` ref).
 * Consumers that need a flat array of pantries call
 * `extractNodes(home.pantriesConnection)` directly.
 *
 * @example
 * ```tsx
 * const { homes, loading, stats, refetch } = useHomeQuery();
 * ```
 */
export function useHomeQuery() {
  const { data, loading, error, refetch } = useQuery(GetHomesDocument, {
    errorPolicy: 'ignore',
  });

  // Preserve homes data even when query fails to prevent cascade failures.
  // Each node carries `id` + `isDefault` directly plus masked refs for the
  // leaf fragments (`HomeCard_home`, `HomeForHookLogic_home`).
  const homes = usePreservedNodes(data?.homes);

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = homes?.find(h => h.isDefault)?.id ?? null;

  // Track the last known pantries count to avoid flickering to 0 during refetch
  const [lastKnownPantriesCount, setLastKnownPantriesCount] =
    useState<number>(0);

  const validHomes = Array.isArray(homes) ? homes.filter(Boolean) : [];

  // Use totalCount from each home's connections.
  type HomeWithCounts = (typeof validHomes)[number] & {
    pantriesConnection?: { totalCount?: number | null };
    membersConnection?: { totalCount?: number | null };
  };

  const totalPantries = (() => {
    const sum = validHomes.reduce(
      (acc, home) =>
        acc +
        getConnectionTotalCount((home as HomeWithCounts).pantriesConnection),
      0,
    );
    // Genuine empty state: no homes means no pantries. Without this guard the
    // anti-flicker fallback below would keep showing the stale last-known
    // count after the user deletes their last home.
    if (validHomes.length === 0) {
      if (lastKnownPantriesCount !== 0) setLastKnownPantriesCount(0);
      return 0;
    }
    if (sum > 0 && sum !== lastKnownPantriesCount) {
      setLastKnownPantriesCount(sum);
      return sum;
    }
    // Anti-flicker: homes are loaded but per-home pantriesConnection counts
    // are transiently 0 during refetch — fall back to the last known count.
    return sum > 0 ? sum : lastKnownPantriesCount;
  })();

  const stats = {
    totalHomes: validHomes.length,
    totalMembers: validHomes.reduce(
      (acc, home) =>
        acc +
        getConnectionTotalCount((home as HomeWithCounts).membersConnection),
      0,
    ),
    totalPantries,
  };

  const memoizedRefetch = async () => {
    await refetch();
  };

  return {
    homes,
    remoteDefaultHomeId,
    loading,
    initialLoading: !homes.length && loading,
    error,
    stats,
    refetch: memoizedRefetch,
  };
}
