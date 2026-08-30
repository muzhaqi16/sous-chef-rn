import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';
import { useOfflineAwareError } from '#hooks/app/useOfflineAwareError';

/**
 * The states a data-backed screen can be in. NOT interchangeable: collapsing
 * `'error'` into `'empty'` tells someone their recipe book is empty when the
 * request merely failed, then offers to recreate what they already own.
 */
export type DataState = 'loading' | 'error' | 'offline' | 'empty' | 'ready';

interface DataStateInput {
  /** The query is in flight. */
  loading: boolean;
  /** The query failed. Apollo's `error`, or any truthy failure marker. */
  error?: unknown;
  /**
   * A response was produced (`data !== undefined`), items or not — separating
   * "the server says nothing" from "we never got an answer".
   */
  hasResult: boolean;
  /** That response contained no items. */
  isEmpty: boolean;
  /**
   * The query was never asked (Apollo's `skip`). Presents exactly like a
   * swallowed error, so without it a deliberate non-request reads as a failure.
   */
  skipped?: boolean;
}

/**
 * Classify a query into the state a person should be shown. The offline/error
 * split is delegated to `useOfflineAwareError`; under `errorPolicy: 'ignore'`
 * Apollo discards the error, so bare absence stands in. `skipped` is checked
 * ABOVE that fallback — what the caller KNOWS beats inferring from no answer.
 */
export function useDataState({
  loading,
  error,
  hasResult,
  isEmpty,
  skipped = false,
}: DataStateInput): DataState {
  const hasData = hasResult && !isEmpty;
  const networkBlocked = useBlocksCacheMissQueries();
  const classified = useOfflineAwareError(error, hasData);

  if (hasData) return 'ready';
  if (loading) return 'loading';
  if (classified.offline) return 'offline';
  if (classified.error) return 'error';
  if (skipped) return 'empty';
  if (!hasResult) return networkBlocked ? 'offline' : 'error';
  return 'empty';
}
