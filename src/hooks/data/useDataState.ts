import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';

/**
 * Which of the states a data-backed screen is in.
 *
 * `'ready'` means there is something to render; every other value means the
 * screen has to say why there is not, and they are not interchangeable. A screen
 * that collapses `'error'` into `'empty'` tells someone their recipe book is
 * empty when the request simply failed — and then offers to create the recipes
 * they already own.
 */
export type DataState = 'loading' | 'error' | 'offline' | 'empty' | 'ready';

interface DataStateInput {
  /** The query is in flight. */
  loading: boolean;
  /** The query failed. Apollo's `error`, or any truthy failure marker. */
  error?: unknown;
  /**
   * A response was produced — `data !== undefined` — regardless of whether it
   * contained any items. This is what separates "the server says there is
   * nothing" from "we never got an answer", and the two must not render alike.
   */
  hasResult: boolean;
  /** That response contained no items. */
  isEmpty: boolean;
}

/**
 * Classify a query into the state a person should be shown.
 *
 * The offline/error split is delegated to `useOfflineAwareError`, which already
 * owns that judgment, so the two can never drift apart. See it for why a query
 * whose variables come from an on-screen control is a guaranteed cache miss
 * offline, and why that is "not downloaded yet" rather than a failure.
 *
 * The one case it cannot answer is a query under `errorPolicy: 'ignore'`, where
 * Apollo discards the error and leaves `data === undefined`. Nothing is left to
 * classify, so absence plus the same offline predicate has to stand in.
 *
 * Priority is deliberate:
 * 1. Data on screen wins over everything. A background refetch that fails must
 *    not blank out content that is already rendered and still true.
 * 2. Loading, so an in-flight first fetch never flashes an error.
 * 3. A cache miss we never attempted — offline.
 * 4. A genuine failure — error.
 * 5. No result and no error at all: the swallowed case above.
 * 6. Genuinely empty.
 */
export function useDataState({
  loading,
  error,
  hasResult,
  isEmpty,
}: DataStateInput): DataState {
  const hasData = hasResult && !isEmpty;
  const networkBlocked = useBlocksCacheMissQueries();
  const classified = useOfflineAwareError(error, hasData);

  if (hasData) return 'ready';
  if (loading) return 'loading';
  if (classified.offline) return 'offline';
  if (classified.error) return 'error';
  if (!hasResult) return networkBlocked ? 'offline' : 'error';
  return 'empty';
}
