import { ApolloLink, Observable } from '@apollo/client';
import { isNetworkError } from '#/utils/isNetworkError';
import { apiReachabilityBreaker } from './apiReachabilityBreaker';

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
 */
export const createNetworkStatusLink = () =>
  new ApolloLink(
    (operation, forward) =>
      new Observable(observer => {
        const subscription = forward(operation).subscribe({
          next: result => {
            if (result.extensions?.queued) {
              if (result.extensions.queuedReason === 'network-error') {
                apiReachabilityBreaker.recordFailure();
              }
            } else {
              apiReachabilityBreaker.recordSuccess();
            }
            observer.next(result);
          },
          error: error => {
            if (isNetworkError(error)) {
              apiReachabilityBreaker.recordFailure();
            }
            observer.error(error);
          },
          complete: () => observer.complete(),
        });
        return () => subscription.unsubscribe();
      }),
  );
