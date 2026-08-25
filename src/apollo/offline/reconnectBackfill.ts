import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

/**
 * Re-reads what the app is already watching, after an outage ends.
 *
 * Nothing else did this. `watchQuery` settles into `nextFetchPolicy:
 * 'cache-first'` once it has fetched, so a screen left mounted across
 * offline → online kept showing pre-outage data indefinitely — until the user
 * pulled to refresh, or navigated away and back. Subscriptions do not cover the
 * gap either: `useSubscriptionTransportRecovery` re-subscribes, which delivers
 * what happens NEXT, not what was published while the socket was down. In a
 * shared home that is a collaborator's whole set of changes.
 *
 * `include: 'active'` is doing real work here, not decoration:
 *
 *   - queries in standby are skipped, which is exactly the repo's
 *     `skip: !isFocused` cross-tab watchers (`useRecipeDiscovery`) — the
 *     cheapest "only what's on screen" filter available, and already in place;
 *   - `cache-only` queries are skipped;
 *   - `skipToken` queries with unknown variables are skipped, which the
 *     deprecated `refetchObservableQueries` does NOT do (it would refire them
 *     with whatever stale variables they hold).
 *
 * `refetch()` forces `network-only` for that one fetch, so a settled
 * `cache-first` query does hit the wire — and the override is disposable, so it
 * does not stick.
 *
 * What this costs: `HomeTabs` and the root `Home` run `inactiveBehavior:
 * 'none'`, so background tabs stay subscribed and are refetched too. That is
 * the intent of keeping them warm — a tab switch after an outage should not
 * show stale data — but it does mean one burst of roughly a tab's worth of
 * queries per outage. Hence: once per transition, after the drain, counted.
 */
export async function backfillActiveQueries(): Promise<number> {
  // The drain's replayed mutations write their own responses into the cache.
  // Refetching at the same moment doubles the burst and races the results, so
  // let the queue finish first.
  await queueManager.whenIdle();

  let refetched = 0;

  try {
    await client.refetchQueries({
      include: 'active',
      // Called once per included query. Nothing is vetoed — `'active'` has
      // already applied the only scoping this layer can honestly do — but the
      // count is what makes the burst measurable instead of assumed.
      onQueryUpdated: () => {
        refetched++;
        return true;
      },
    });
  } catch (error) {
    // A flaky reconnect can reject individual refetches; the next transition
    // (or a screen's own refresh) will try again. Never let this surface.
    logger.debug('Reconnect backfill did not complete cleanly:', error);
  }

  logger.info(`🔄 Backfill: refetched ${refetched} active quer(ies)`);
  Telemetry.increment('reconnect_backfill_queries_total', refetched);

  return refetched;
}
