import type { WatchQueryFetchPolicy } from '@apollo/client';

/**
 * A secondary consumer on another tab stands its watcher down while blurred via
 * `skip`, and must pair that with `fetchPolicy: 'cache-first'`: Apollo resets a
 * re-enabled query to its INITIAL policy, so toggling `skip` alone pays a
 * `cache-and-network` round-trip on every focus.
 */
export interface StandDownOptions {
  skip?: boolean;
  fetchPolicy?: WatchQueryFetchPolicy;
}

/**
 * A caller's policy as query options. It holds for the query's life: the client
 * default `nextFetchPolicy: 'cache-first'` would let a `cache-only` read fetch.
 */
export const heldFetchPolicy = (fetchPolicy?: WatchQueryFetchPolicy) =>
  fetchPolicy ? { fetchPolicy, nextFetchPolicy: fetchPolicy } : {};
