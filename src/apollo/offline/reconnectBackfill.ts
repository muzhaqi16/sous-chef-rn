import { client } from '#/apollo/client';
import { queueManager } from '#/apollo/offlineQueue/queueManager';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';

/**
 * Re-reads what the app is already watching once an outage ends: `watchQuery`
 * settles into `cache-first`, so a screen mounted across offline → online keeps
 * pre-outage data, and re-subscribing only delivers what happens NEXT. One
 * burst per transition — `HomeTabs` keeps background tabs subscribed too.
 */
export async function backfillActiveQueries(): Promise<number> {
  // Replayed mutations write their own responses into the cache; refetching at
  // the same moment doubles the burst and races the results.
  await queueManager.whenIdle();

  let refetched = 0;

  try {
    // 'active' skips standby queries (the repo's `skip: !isFocused` watchers),
    // `cache-only` ones, and unknown-variable `skipToken` ones, which
    // `refetchObservableQueries` would refire with stale variables. Each
    // `refetch()` forces one disposable `network-only` fetch.
    await client.refetchQueries({
      include: 'active',
      // Nothing is vetoed — `'active'` already applied the only scoping this
      // layer can honestly do — but counting makes the burst measurable.
      onQueryUpdated: () => {
        refetched++;
        return true;
      },
    });
  } catch (error) {
    // A flaky reconnect can reject individual refetches; the next transition
    // retries. Never let this surface.
    logger.debug('Reconnect backfill did not complete cleanly:', error);
  }

  logger.info(`🔄 Backfill: refetched ${refetched} active quer(ies)`);
  Telemetry.increment('reconnect_backfill_queries_total', refetched);

  return refetched;
}
