import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { authLink } from './authLink';
import { createConsoleLink } from './consoleLink';
import { createTelemetryLink } from './telemetryLink';
import { createOfflineModeLink } from './offlineModeLink';
import { errorLink } from './errorLink';
import { retryLink } from './retryLink';
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

  // Offline mode link - blocks queries when user has enabled offline mode
  const offlineModeLink = createOfflineModeLink();

  // Queue link for offline mutation support
  const queueLink = createQueueLink();

  // Link chain - ordered by priority
  // Offline support is handled by:
  // 1. offlineModeLink - blocks queries when user-enabled offline mode is active
  // 2. retryLink - retries transient network failures for queries (mutations are skipped)
  // 3. errorLink - catches non-retryable failures, returns cached data
  // 4. fetch policies (cache-and-network → cache-first) - immediate cache, then network
  // 5. queueLink - queues mutations when offline
  // Note: Query deduplication is handled by Apollo Client's built-in queryDeduplication: true
  return ApolloLink.from([
    offlineModeLink, // Block queries when offline mode enabled (before telemetry to skip tracking)
    telemetryLink, // Track operations for monitoring
    retryLink, // Retry transient network failures (queries only)
    errorLink, // Handle/log errors + return cached data on network failures
    authLink, // Authentication headers
    queueLink, // Queue mutations when offline
    consoleLink, // Development logging
    transportLink, // HTTP/WebSocket transport
  ]);
}
