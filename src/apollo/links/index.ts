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

// Single console link configuration (simplified)
const consoleLink = createConsoleLink({
  enabled: false, // __DEV__,
  logVariables: false,
  logQuery: false,
  logResponse: false,
  logTiming: true,
  slowQueryThreshold: 1000,
});

// Telemetry link for tracking GraphQL operations
const telemetryLink = createTelemetryLink();

// Simplified link chain - work WITH Apollo, not against it
export const link = ApolloLink.from([
  deduplicationLink, // Prevent duplicate requests
  telemetryLink,     // Track operations for monitoring
  errorLink,         // Handle/log errors (simplified)
  authLink,          // Authentication headers
  consoleLink,       // Development logging
  transportLink,     // HTTP/WebSocket transport
]);
