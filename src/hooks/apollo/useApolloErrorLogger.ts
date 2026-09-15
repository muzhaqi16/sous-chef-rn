import { useEffect } from 'react';
import type { DocumentNode } from 'graphql';
import { InvariantError } from '@apollo/client/utilities/invariant';
import { operationNameOf } from '#/apollo/utils/documentOperation';
import { Telemetry } from '#/services/telemetry';
import { storeApi } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { logger } from '#/utils/environment';

// Apollo raises its own faults as `InvariantError`: a cache write its type
// policies refuse, a store cleared under an in-flight query. Release builds
// replace the message with a code URL, so the class is the only stable signal.
export function useApolloErrorLogger(
  document: DocumentNode,
  error: { message: string } | undefined,
): void {
  const operationName = operationNameOf(document);
  if (__DEV__ && error) {
    if (error instanceof InvariantError) {
      // Client-side, unrelated to reachability — always surface it.
      logger.warn(
        `[${operationName}] Apollo invariant — a client-side cache or link fault:`,
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
    const invariant = error instanceof InvariantError;
    Telemetry.error(
      `Apollo ${invariant ? 'invariant' : 'query'} error: ${operationName}`,
      {
        operation_name: operationName,
        error_message: error.message,
        error_type: invariant ? 'apollo_invariant' : 'graphql',
      },
    );
    Telemetry.increment('apollo_client_errors_total', 1, {
      operation: operationName,
      type: invariant ? 'invariant' : 'graphql',
    });
  }, [operationName, error]);
}
