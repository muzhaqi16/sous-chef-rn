import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { authLink } from './authLink';
import { createConsoleLink } from './consoleLink';
import { createTelemetryLink } from './telemetryLink';
import { errorLink } from './errorLink';
import { httpLink } from './httpLink';
import { wsLink } from './wsLink';
import { deduplicationLink } from './deduplicationLink';

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
 * VANILLA configuration - no offline queue, no cache persistence
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

  // Link chain - let Apollo handle everything automatically
  return ApolloLink.from([
    deduplicationLink, // Prevent duplicate requests
    telemetryLink, // Track operations for monitoring
    errorLink, // Handle/log errors
    authLink, // Authentication headers
    consoleLink, // Development logging
    transportLink, // HTTP/WebSocket transport
  ]);
}
