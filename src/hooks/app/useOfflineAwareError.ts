import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';

interface OfflineAwareError<E> {
  /** A genuine failure worth reporting. Undefined when `offline` is true. */
  error: E | undefined;
  /** No network was attempted and nothing was cached — not a failure. */
  offline: boolean;
}

/** Splits "the server is unreachable" from a real failure. */
export function useOfflineAwareError<E>(
  error: E | undefined,
  hasData: boolean,
): OfflineAwareError<E> {
  const networkBlocked = useIsApiUnavailable();
  const unavailableOffline = networkBlocked && !!error && !hasData;

  return {
    error: unavailableOffline ? undefined : error,
    offline: unavailableOffline,
  };
}
