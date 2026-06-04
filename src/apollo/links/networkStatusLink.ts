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
 *    `extensions.queued` (it was queued *because* of a network error) — counted
 *    as a failure, not a success.
 */
export const createNetworkStatusLink = () =>
  new ApolloLink(
    (operation, forward) =>
      new Observable(observer => {
        const subscription = forward(operation).subscribe({
          next: result => {
            if (result.extensions?.queued) {
              apiReachabilityBreaker.recordFailure();
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
