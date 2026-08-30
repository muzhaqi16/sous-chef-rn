import { ApolloLink, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { isNetworkError } from '#/utils/isNetworkError';
import { logger } from '#/utils/environment';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';
import { isOfflineRejectedError } from '../offlineQueue/OfflineRejectedError';
import { apiReachabilityBreaker } from './apiReachabilityBreaker';

const describeError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: string } | null)?.message;
  return message ?? String(error);
};

/**
 * Feeds the reachability breaker one outcome per operation. Placement is
 * load-bearing: above `retryLink` (retries absorbed), below `offlineModeLink`
 * (blocked traffic never counts), above `queueLink` (only a mutation queued
 * after a REAL network failure counts). Subscriptions never feed it.
 */
export const createNetworkStatusLink = () =>
  new ApolloLink((operation, forward) => {
    const operationName = operation.operationName || 'unnamed';
    const definition = getMainDefinition(operation.query);
    if (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    ) {
      // Still log subscription errors (without counting them) so a WS failure
      // burst is visible next to the breaker's own entries — the evidence
      // trail for "the circuit opened because of WS noise, not HTTP". Debug
      // level: one socket drop errors every active subscription at once.
      return new Observable(observer => {
        const subscription = forward(operation).subscribe({
          next: result => observer.next(result),
          error: error => {
            logger.debug(
              `🔌 subscription error (not counted by reachability breaker) — ${operationName}: ${describeError(
                error,
              )}`,
            );
            observer.error(error);
          },
          complete: () => observer.complete(),
        });
        return () => subscription.unsubscribe();
      });
    }

    const operationKind =
      definition.kind === 'OperationDefinition'
        ? definition.operation
        : 'query';

    return new Observable(observer => {
      const subscription = forward(operation).subscribe({
        next: result => {
          if (result.extensions?.queued) {
            if (result.extensions.queuedReason === 'network-error') {
              apiReachabilityBreaker.recordFailure(
                `${operationName} (${operationKind}): queued after a network error`,
              );
            }
          } else {
            apiReachabilityBreaker.recordSuccess(
              `${operationName} (${operationKind})`,
            );
          }
          observer.next(result);
        },
        error: error => {
          // queueLink's offline fast-fail proves nothing about API reachability —
          // it never touched the network. Propagate it (the hook still surfaces
          // the honest offline failure) but keep it out of the breaker.
          if (isOfflineRejectedError(error)) {
            observer.error(error);
            return;
          }
          if (isNetworkError(error)) {
            apiReachabilityBreaker.recordFailure(
              `${operationName} (${operationKind}): ${describeError(error)}`,
            );
            // One warning per operation: this link sits above retryLink, so
            // retries are absorbed. Suppressed once offline or the circuit is
            // open — the breaker's one-line verdict is the signal then.
            const state = useStore.getState();
            if (!state.offlineModeEnabled && !isApiUnavailable(state)) {
              logger.warn(
                `Network error for ${operationName}: ${describeError(error)}`,
              );
            }
          }
          observer.error(error);
        },
        complete: () => observer.complete(),
      });
      return () => subscription.unsubscribe();
    });
  });
