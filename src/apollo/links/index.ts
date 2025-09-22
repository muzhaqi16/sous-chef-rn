import { ApolloLink } from '@apollo/client';
import { getMainDefinition } from '@apollo/client/utilities';
import { authLink } from './authLink';
import { createConsoleLink } from './consoleLink';
import { errorLink } from './errorLink';
import { httpLink } from './httpLink';
import { batchLink } from './batchLink';
import { wsLink } from './wsLink';
import { retryLink } from './retryLink';
import { deduplicationLink } from './deduplicationLink';

// HTTP transport with retry and batching (re-enabled for performance)
const httpTransport = retryLink.concat(__DEV__ ? httpLink : batchLink);

// Transport link routing:
// • Subscriptions → WebSocket
// • All other operations → HTTP with retry + batching (production) or regular HTTP (dev)
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

// Simplified link chain
export const link = ApolloLink.from([
  deduplicationLink,
  errorLink,
  authLink,
  consoleLink,
  transportLink,
]);
