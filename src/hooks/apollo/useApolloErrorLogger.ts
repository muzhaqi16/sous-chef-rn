import { useEffect } from 'react';
import { Telemetry } from '#/services/telemetry';
import { storeApi } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { logger } from '#/utils/environment';

const CACHE_ERROR_PATTERNS = [
  'Missing field',
  'Could not identify object',
  'Cache data may be lost',
  'keyFields',
];

function isCacheError(message: string): boolean {
  return CACHE_ERROR_PATTERNS.some(p => message.includes(p));
}

export function useApolloErrorLogger(
  operationName: string,
  error: { message: string } | undefined,
): void {
  if (__DEV__ && error) {
    if (isCacheError(error.message)) {
      // A typePolicy bug, unrelated to reachability — always surface it.
      logger.warn(
        `[${operationName}] Cache error — check typePolicies in cache.ts:`,
        error.message,
      );
    } else if (!isApiUnavailable(storeApi.getState())) {
      // Suppress the per-component network-error wall once the API is
      // known-unavailable — the breaker's verdict + networkStatusLink's
      // per-operation warning are the signal then.
      logger.warn(`[${operationName}] Query error:`, error.message);
    }
  }

  useEffect(() => {
    if (!error) return;
    const cacheError = isCacheError(error.message);
    Telemetry.error(
      `Apollo ${cacheError ? 'cache' : 'query'} error: ${operationName}`,
      {
        operation_name: operationName,
        error_message: error.message,
        error_type: cacheError ? 'cache_normalization' : 'graphql',
      },
    );
    Telemetry.increment('apollo_client_errors_total', 1, {
      operation: operationName,
      type: cacheError ? 'cache' : 'graphql',
    });
  }, [operationName, error]);
}
