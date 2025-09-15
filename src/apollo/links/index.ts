import {ApolloLink, split} from '@apollo/client';
import {getMainDefinition} from '@apollo/client/utilities';
import {authLink} from './authLink';
import {createConsoleLink} from './consoleLink';
import {errorLink} from './errorLink';
import {httpLink} from './httpLink';
import {wsLink} from './wsLink';
import {retryLink} from './retryLink';
import {deduplicationLink} from './deduplicationLink';

const retriableHttp = retryLink.concat(httpLink);

// Simple transport link routing:
// • Subscriptions → WebSocket
// • Queries & Mutations → HTTP with retry
const transportLink = split(
  ({query}) => {
    const def = getMainDefinition(query);
    return (
      def.kind === 'OperationDefinition' && def.operation === 'subscription'
    );
  },
  wsLink,
  retriableHttp,
);

// TODO: Future enhancement - HTTP Batch Link
// Consider adding BatchHttpLink for query optimization:
// - Combine multiple queries into single requests
// - Reduce HTTP overhead
// - Requires proper server-side batching support
// - Need proper headers and fetch configuration

// Default settings (recommended)
const consoleLink = createConsoleLink({
  enabled: false,
});

// Production-optimized logging
const consoleLinkOptimized = createConsoleLink({
  enabled: __DEV__ && true, // Enable only in dev
  logVariables: false, // Disable by default for performance
  logQuery: false, // Disable by default for performance
  logResponse: false, // Disable by default for performance
  logTiming: true, // Keep timing for performance monitoring
  slowQueryThreshold: 1000, // Standard threshold
});

// Debug logging (can be enabled when needed)
const consoleLinkDebug = createConsoleLink({
  enabled: __DEV__ && false, // Disabled by default, can be enabled for debugging
  logVariables: true,
  logQuery: true,
  logResponse: true,
  logTiming: true,
  slowQueryThreshold: 300,
});

// Combine links: errorLink comes first to catch errors from subsequent links
export const link = ApolloLink.from([
  deduplicationLink, // Deduplicate identical queries first
  errorLink,
  authLink,
  consoleLinkOptimized, // Use optimized console link by default
  transportLink,
]);
