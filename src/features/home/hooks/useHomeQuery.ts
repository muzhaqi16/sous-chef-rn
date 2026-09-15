/** Fetches the user's homes, preserves them across failures, computes stats. */

import { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { GetHomesDocument } from '#operations/home/home.generated';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import { getConnectionTotalCount } from '#/utils/connectionUtils';

/**
 * `errorPolicy: 'ignore'` so a failed fetch yields the cached homes rather than
 * nothing; the client defaults supply the fetch policy. Returns connection-shape
 * nodes, so a consumer wanting a flat pantry array calls
 * `extractNodes(home.pantriesConnection)` itself.
 */
export function useHomeQuery() {
  const { data, loading, refetch } = useQuery(GetHomesDocument, {
    errorPolicy: 'ignore',
  });

  // Preserve homes data even when the query fails, to prevent cascade
  // failures. Each node carries `id` + `isDefault` directly plus a masked ref
  // for `HomeCard_home`.
  const homes = usePreservedNodes(data?.homes);

  // Derive default home from isDefault field (no separate query needed)
  const remoteDefaultHomeId = homes?.find(h => h.isDefault)?.id ?? null;

  // Track the last known pantries count to avoid flickering to 0 during refetch
  const [lastKnownPantriesCount, setLastKnownPantriesCount] =
    useState<number>(0);

  const validHomes = Array.isArray(homes) ? homes.filter(Boolean) : [];

  // Use totalCount from each home's connections.
  const totalPantries = (() => {
    const sum = validHomes.reduce(
      (acc, home) => acc + getConnectionTotalCount(home.pantriesConnection),
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
      (acc, home) => acc + getConnectionTotalCount(home.membersConnection),
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
    // A defined `data` with zero homes is still an answer. `errorPolicy:
    // 'ignore'` discards the error, so a settled read with neither is the failure.
    hasResult: data !== undefined || homes.length > 0,
    stats,
    refetch: memoizedRefetch,
  };
}
