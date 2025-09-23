import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { authLink } from './authLink';
import { createConsoleLink } from './consoleLink';
import { createTelemetryLink } from './telemetryLink';
import { errorLink } from './errorLink';
import { httpLink } from './httpLink';
import { wsLink } from './wsLink';
import { retryLink } from './retryLink';
import { deduplicationLink } from './deduplicationLink';

// HTTP transport with retry (batching disabled until server supports it)
const httpTransport = retryLink.concat(httpLink);

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

// Simplified link chain
export const link = ApolloLink.from([
  deduplicationLink,
  telemetryLink,
  errorLink,
  authLink,
  consoleLink,
  transportLink,
]);
