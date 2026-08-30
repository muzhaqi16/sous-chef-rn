import { useEffect, useState } from 'react';
import { useIsOnline, useUserId } from '#store/useAppStore';
import { backfillActiveQueries } from '#/apollo/offline/reconnectBackfill';

/**
 * Runs `backfillActiveQueries` once per offline → online transition. Separate
 * from `useOnlineQueueSync`, whose effect also re-runs when the user or token
 * lands — a backfill answers an outage ending, not credentials arriving. The
 * counter is render-time so the effect needs no `setState` of its own.
 */
export function useReconnectBackfill(): void {
  const isOnline = useIsOnline();
  const userId = useUserId();

  const [wasOnline, setWasOnline] = useState(isOnline);
  const [reconnectCount, setReconnectCount] = useState(0);

  if (wasOnline !== isOnline) {
    setWasOnline(isOnline);
    // Signed out, there are no watched queries worth refreshing, and whoever
    // signs in next fetches from scratch.
    if (isOnline && userId) {
      setReconnectCount(count => count + 1);
    }
  }

  useEffect(() => {
    if (reconnectCount === 0) return;
    void backfillActiveQueries();
  }, [reconnectCount]);
}
