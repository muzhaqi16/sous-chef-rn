import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';

interface OfflineAwareError<E> {
  /** A genuine failure worth reporting. Undefined when `offline` is true. */
  error: E | undefined;
  /** No network was attempted and nothing was cached — not a failure. */
  offline: boolean;
}

/**
 * Splits `offlineModeLink`'s synthetic "no cached data" result away from a real
 * query failure.
 *
 * With no network leg, the link answers a cache miss with an error so Apollo
 * doesn't write `{}` against the selection set. That error means "we never
 * tried", not "the request failed" — rendering it as a failure puts an alert on
 * a screen where nothing is wrong.
 *
 * This matters most for queries whose variables come from an on-screen control
 * (a date range, a selected pantry, a category). Each combination is its own
 * cache entry, so offline the first touch of that control is a guaranteed miss
 * even on a screen that was fully populated a moment earlier. Persisting the
 * cache does not help — only the combinations already fetched are in it.
 *
 * `hasData` is what keeps this honest in the other direction: a cached hit
 * alongside a failed background revalidation stays a reportable error, as does
 * any failure while online.
 */
export function useOfflineAwareError<E>(
  error: E | undefined,
  hasData: boolean,
): OfflineAwareError<E> {
  const networkBlocked = useBlocksCacheMissQueries();
  const unavailableOffline = networkBlocked && !!error && !hasData;

  return {
    error: unavailableOffline ? undefined : error,
    offline: unavailableOffline,
  };
}
