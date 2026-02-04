import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { authLink } from './authLink';
import { createConsoleLink } from './consoleLink';
import { createTelemetryLink } from './telemetryLink';
import { errorLink } from './errorLink';
import { httpLink } from './httpLink';
import { wsLink } from './wsLink';
import { createQueueLink } from '../offlineQueue/queueLink';

// Simplified HTTP transport (let Apollo handle retries naturally)
const httpTransport = httpLink;

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

  // Queue link for offline mutation support
  const queueLink = createQueueLink();

  // Link chain - ordered by priority
  // Offline support is handled by:
  // 1. errorLink - catches network failures, returns cached data
  // 2. fetch policies (cache-and-network → cache-first) - immediate cache, then network
  // 3. queueLink - queues mutations when offline
  // Note: Query deduplication is handled by Apollo Client's built-in queryDeduplication: true
  return ApolloLink.from([
    telemetryLink, // Track operations for monitoring
    errorLink, // Handle/log errors + return cached data on network failures
    authLink, // Authentication headers
    queueLink, // Queue mutations when offline
    consoleLink, // Development logging
    transportLink, // HTTP/WebSocket transport
  ]);
}
