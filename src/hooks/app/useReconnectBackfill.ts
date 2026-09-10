import { useEffect, useState } from 'react';
import { useAppStore, useUserId } from '#store/useAppStore';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { backfillActiveQueries } from '#/apollo/offline/reconnectBackfill';

/**
 * Runs `backfillActiveQueries` once per unreachable → reachable transition —
 * separate from `useOnlineQueueSync`, which also re-runs when the user or token
 * lands. Keyed on `isApiUnavailable`, not the device link: an API-only outage
 * leaves `isOnline` true, so nothing else refreshes watched queries.
 */
export function useReconnectBackfill(): void {
  const apiUnavailable = useAppStore(isApiUnavailable);
  const userId = useUserId();

  const [wasUnavailable, setWasUnavailable] = useState(apiUnavailable);
  const [reconnectCount, setReconnectCount] = useState(0);

  if (wasUnavailable !== apiUnavailable) {
    setWasUnavailable(apiUnavailable);
    // Signed out, there are no watched queries worth refreshing, and whoever
    // signs in next fetches from scratch.
    if (!apiUnavailable && userId) {
      setReconnectCount(count => count + 1);
    }
  }

  useEffect(() => {
    if (reconnectCount === 0) return;
    void backfillActiveQueries();
  }, [reconnectCount]);
}
