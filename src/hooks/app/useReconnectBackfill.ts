import { useEffect, useState } from 'react';
import { useUserId } from '#store/useAppStore';
import { useIsApiUnavailable } from '#/hooks/app/useIsApiUnavailable';
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
 *
 * The trigger is the DERIVED reachability decision, not the raw device link.
 * Reading `isOnline` meant the most common outage there is — the API down while
 * connectivity is fine, which is the only shape the reachability breaker exists
 * for — ended with no backfill at all: `nextFetchPolicy: 'cache-first'` stops a
 * settled observable correcting itself, and `HomeTabs` runs
 * `inactiveBehavior: 'none'` so background tabs stay mounted too. Every screen
 * kept pre-outage data until the user pulled to refresh, with no spinner and no
 * error to suggest it. One condition now covers both outage shapes.
 */
export function useReconnectBackfill(): void {
  const isUnavailable = useIsApiUnavailable();
  const userId = useUserId();

  const [wasUnavailable, setWasUnavailable] = useState(isUnavailable);
  const [reconnectCount, setReconnectCount] = useState(0);

  if (wasUnavailable !== isUnavailable) {
    setWasUnavailable(isUnavailable);
    // Signed out, there are no watched queries worth refreshing, and whoever
    // signs in next fetches from scratch.
    if (!isUnavailable && userId) {
      setReconnectCount(count => count + 1);
    }
  }

  useEffect(() => {
    if (reconnectCount === 0) return;
    void backfillActiveQueries();
  }, [reconnectCount]);
}
