import {ApolloLink, split} from '@apollo/client';
import {getMainDefinition} from '@apollo/client/utilities';
import {authLink} from './authLink';
import {createConsoleLink} from './consoleLink';
import {errorLink} from './errorLink';
import {httpLink} from './httpLink';
import {persistLink} from './persistLink';
import {wsLink} from './wsLink';
import {retryLink} from './retryLink';

const retriableHttp = retryLink.concat(httpLink);

// create a link that sends •subscriptions• to wsLink, and •queries/mutations• to httpLink
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

// Default settings (recommended)
const consoleLink = createConsoleLink({
  enabled: false,
});

// Custom settings
const consoleLinkCustom = createConsoleLink({
  enabled: __DEV__ && true, // Enable only in dev
  logVariables: true, // Log request variables
  logQuery: false, // Don't log full query (can be verbose)
  logResponse: true, // Log response data
  logTiming: true, // Log execution time
  slowQueryThreshold: 500, // Warn if query takes longer than 500ms
});

// Minimal logging
const consoleLinkMinimal = createConsoleLink({
  logVariables: false,
  logQuery: false,
  logResponse: false,
  logTiming: true, // Only log timing
});
// Combine links: errorLink comes first to catch errors from subsequent links
export const link = ApolloLink.from([
  persistLink,
  errorLink,
  authLink,
  consoleLink,
  transportLink,
]);
