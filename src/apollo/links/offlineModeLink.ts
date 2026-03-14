import { ApolloLink, Observable } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { useStore } from '#store';

/**
 * Operations that must always reach the network, even in offline mode.
 * - RefreshToken: Required for auth token rotation
 * - GetUserSettings: Required to sync settings changes (including toggling offline mode off)
 */
const ALWAYS_ALLOW = ['RefreshToken', 'GetUserSettings'];

/**
 * Apollo Link that blocks query network requests when the user has enabled offline mode.
 *
 * - Queries: Short-circuited (completes without forwarding). Apollo has already read
 *   from cache before the link chain fires for cache-and-network/cache-first policies,
 *   so the UI still renders cached data.
 * - Mutations: Pass through to queueLink which handles offline queuing.
 * - Subscriptions: Pass through (WebSocket connection handles its own lifecycle).
 *
 * This approach avoids the query cascade issue caused by dynamic fetchPolicy changes
 * (see docs/apollo-client-patterns.md "Why NOT useOfflinePresetPolicy").
 */
export const createOfflineModeLink = () => {
  return new ApolloLink((operation, forward) => {
    const { offlineModeEnabled } = useStore.getState();
    if (!offlineModeEnabled) {
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

    // Short-circuit: complete without data. Apollo uses cached data already read
    // before the link chain fires.
    return new Observable(observer => {
      observer.complete();
    });
  });
};
