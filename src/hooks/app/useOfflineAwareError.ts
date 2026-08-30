import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';

interface OfflineAwareError<E> {
  /** A genuine failure worth reporting. Undefined when `offline` is true. */
  error: E | undefined;
  /** No network was attempted and nothing was cached — not a failure. */
  offline: boolean;
}

/**
 * Splits `offlineModeLink`'s synthetic "no cached data" error ("we never tried")
 * from a real failure. Matters most for user-driven variables: each combination
 * is its own cache entry, so offline the first touch of a control is a
 * guaranteed miss. `hasData` keeps a failed revalidation reportable.
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
