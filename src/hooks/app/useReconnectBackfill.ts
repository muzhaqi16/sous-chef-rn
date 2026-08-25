import { useEffect, useState } from 'react';
import { useIsOnline, useUserId } from '#store/useAppStore';
import { backfillActiveQueries } from '#/apollo/offline/reconnectBackfill';

/**
 * Runs {@link backfillActiveQueries} once per offline → online transition.
 *
 * Kept apart from `useOnlineQueueSync` deliberately. That hook's effect also
 * re-runs when the user or the access token lands, and a backfill must not fire
 * on those: it is a response to an outage ending, not to credentials arriving.
 *
 * The transition is detected by adjusting state during render rather than by
 * comparing against a ref, and it is expressed as a counter so the effect below
 * needs no state update of its own — a synchronous `setState` inside an effect
 * is what `react-hooks/set-state-in-effect` exists to stop. The counter changes
 * exactly once per reconnect, so the effect fires exactly once per reconnect.
 *
 * A launch that begins online never increments it: there is nothing to catch up
 * on when every query is already fetching fresh.
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
