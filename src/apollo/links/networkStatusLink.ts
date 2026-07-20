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
 * Observes one network outcome per operation and feeds the API-reachability
 * circuit breaker ({@link apiReachabilityBreaker}).
 *
 * Placement (high in the chain, just below `offlineModeLink` and above
 * `retryLink`/`queueLink`) is load-bearing:
 *  - Above `retryLink`: retries are absorbed, so this sees ONE outcome per
 *    operation (not one per attempt).
 *  - Below `offlineModeLink`: queries short-circuited while offline never reach
 *    here, so blocked traffic doesn't feed the breaker.
 *  - Above `queueLink`: a queued mutation bubbles up as `next` carrying
 *    `extensions.queued` + `extensions.queuedReason`. Only a mutation queued
 *    after a REAL network failure (`queuedReason: 'network-error'`) counts as
 *    a breaker failure. Mutations queued preemptively — device offline, or
 *    queued *because* the breaker is already open (`'offline'` /
 *    `'api-unreachable'`) — never touched the network: counting them would
 *    feed the breaker its own output, which can keep a stale open/false state
 *    alive with zero evidence the API is actually down.
 *
 * Subscriptions never feed the breaker (their errors are logged for
 * diagnostics only). They ride the WebSocket transport, which owns its own
 * health (keep-alive pings, backoff reconnects, and auth-close handling in
 * `wsLink`) — a WS error says nothing about HTTP reachability. Worse, one
 * socket drop errors EVERY active subscription at once, so counting them
 * tripped the 3-failure threshold and opened the circuit while the HTTP API
 * was healthy (login worked while the banner said "Can't reach the server").
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
            // One warning per operation. This link is above retryLink, so
            // retries are absorbed — errorLink (below retryLink) used to log
            // every attempt, producing a wall of identical warnings. Suppressed
            // once offline / circuit open: then the breaker's one-line verdict
            // is the signal. Reading state after recordFailure naturally
            // silences the operation that trips the circuit.
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
