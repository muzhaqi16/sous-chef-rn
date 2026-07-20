import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { authLink } from './authLink';
import { createConsoleLink } from './consoleLink';
import { createTelemetryLink } from './telemetryLink';
import { createOfflineModeLink } from './offlineModeLink';
import { createNetworkStatusLink } from './networkStatusLink';
import { errorLink } from './errorLink';
import { retryLink } from './retryLink';
import { httpLink } from './httpLink';
import { wsLink } from './wsLink';
import { persistedQueryLink } from './persistedQueryLink';
import { createQueueLink } from '../offlineQueue/queueLink';

// HTTP transport with APQ / operation-safelist hashes. The persisted-query
// link sits on the HTTP branch only: subscriptions ride graphql-ws where the
// APQ protocol (and the server's safelist plugin) does not apply.
const httpTransport = ApolloLink.from([persistedQueryLink, httpLink]);

// Transport link routing:
// • Subscriptions → WebSocket
// • All other operations → HTTP with retry
const transportLink = ApolloLink.split(
  ({ query }) => {
    const def = getMainDefinition(query);
    return (
      def.kind === 'OperationDefinition' && def.operation === 'subscription'
    );
  },
  wsLink,
  httpTransport,
);

/**
 * Create link chain for Apollo client
 * Full-featured configuration with offline support
 */
export function createLink() {
  // Console link configuration - only verbose in development
  const consoleLink = createConsoleLink({
    enabled: __DEV__,
    logVariables: __DEV__,
    logQuery: false, // Too verbose, disable even in dev
    logResponse: false, // Too verbose, disable even in dev
    logTiming: true,
    slowQueryThreshold: 1000,
  });

  // Telemetry link for tracking GraphQL operations
  const telemetryLink = createTelemetryLink();

  // Offline mode link - blocks queries when user has enabled offline mode
  const offlineModeLink = createOfflineModeLink();

  // Network status link - drives the API-reachability circuit breaker
  const networkStatusLink = createNetworkStatusLink();

  // Queue link for offline mutation support
  const queueLink = createQueueLink();

  // Link chain - ordered by priority
  // Offline support is handled by:
  // 1. offlineModeLink - serves queries from cache (short-circuits the network)
  //    when offline: user-enabled offline mode OR device offline (isOnline=false).
  //    Sits first, so blocked queries never reach retryLink/errorLink (no doomed
  //    requests, no retry/error noise). Mutations pass through to queueLink.
  // 2. retryLink - retries transient network failures for queries (mutations are
  //    skipped); the remaining case is API-down-while-online.
  // 3. errorLink - catches non-retryable failures, returns cached data
  // 4. fetch policies (cache-and-network → cache-first) - immediate cache, then network
  // 5. queueLink - queues mutations when offline
  // Note: Query deduplication is handled by Apollo Client's built-in queryDeduplication: true
  return ApolloLink.from([
    offlineModeLink, // Block queries when effectively offline (before telemetry to skip tracking)
    networkStatusLink, // Feed the API-reachability circuit breaker (one outcome/op)
    telemetryLink, // Track operations for monitoring
    retryLink, // Retry transient network failures (queries only)
    errorLink, // Handle/log errors + return cached data on network failures
    authLink, // Authentication headers
    queueLink, // Queue mutations when offline
    consoleLink, // Development logging
    transportLink, // HTTP/WebSocket transport
  ]);
}
