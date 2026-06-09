import { ApolloLink, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { useStore } from '#store';
import { isApiUnavailable } from '#store/slices/networkSlice';

/**
 * Operations that must always reach the network, even in offline mode.
 * - RefreshToken: Required for auth token rotation
 * - GetUserSettings: Required to sync settings changes (including toggling offline mode off)
 */
const ALWAYS_ALLOW = ['RefreshToken', 'GetUserSettings'];

/**
 * Apollo Link that blocks query network requests when the network leg can only
 * fail — i.e. the user enabled offline mode, OR the API is unavailable
 * (`isApiUnavailable`: the device is offline, or the reachability circuit breaker
 * has opened because the API is down while the device is online). In all cases
 * Apollo has already read from cache before the link chain fires, so
 * short-circuiting serves cached data without firing a doomed request (and
 * without the retryLink/errorLink retry+warn noise that doomed attempts produce).
 *
 * - Queries: Served from cache. The link reads the query back out of the cache
 *   and emits it as the result, then completes — no network request. Apollo
 *   Client 4.x requires a link to emit a value before completing (it errors
 *   with "link chain completed without emitting a value" otherwise), and
 *   re-emitting the cached data is an idempotent write that never clobbers the
 *   populated cache. The query settles with no loading spinner and no error.
 * - Mutations: Pass through to queueLink which handles offline queuing.
 * - Subscriptions: Pass through (WebSocket connection handles its own lifecycle).
 *
 * `isOnline` errs toward "online" (only false when NetInfo is confident the device
 * is offline — `isConnected === false` or `isInternetReachable === false`), so a
 * transient unknown state doesn't wrongly block. The "API-down-while-online" case
 * (`isOnline === true`, API unreachable) is intentionally NOT covered here — those
 * requests still flow through retryLink/errorLink as before.
 *
 * This approach avoids the query cascade issue caused by dynamic fetchPolicy changes
 * (see docs/apollo-client-patterns.md "Why NOT useOfflinePresetPolicy").
 */
export const createOfflineModeLink = () => {
  return new ApolloLink((operation, forward) => {
    const state = useStore.getState();
    if (!state.offlineModeEnabled && !isApiUnavailable(state)) {
      return forward(operation);
    }

    // Allow-listed operations always pass through
    const operationName = operation.operationName || '';
    if (ALWAYS_ALLOW.includes(operationName)) {
      return forward(operation);
    }

    const definition = getMainDefinition(operation.query);

    // Only block queries — mutations queue via queueLink, subscriptions manage themselves
    if (
      definition.kind !== 'OperationDefinition' ||
      definition.operation !== 'query'
    ) {
      return forward(operation);
    }

    // Serve the query from cache instead of forwarding to the network. Read the
    // query back out of the cache and emit it as the result — Apollo Client 4.x
    // throws "link chain completed without emitting a value" if a link completes
    // without emitting, and re-emitting the cached data is an idempotent write
    // (it never clobbers a populated cache, unlike emitting `{}`/`null`). On a
    // cache miss readQuery returns null, which the consumer hooks already guard.
    return new Observable<ApolloLink.Result>(observer => {
      let cached: Record<string, unknown> | null = null;
      try {
        cached = operation.client.cache.readQuery<Record<string, unknown>>({
          query: operation.query,
          variables: operation.variables,
        });
      } catch {
        cached = null;
      }
      observer.next({ data: cached });
      observer.complete();
    });
  });
};
