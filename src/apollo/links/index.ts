import {ApolloLink, split} from '@apollo/client';
import {getMainDefinition} from '@apollo/client/utilities';
import {authLink} from './authLink';
import {consoleLink} from './consoleLink';
import {errorLink} from './errorLink';
import {httpLink} from './httpLink';
import {persistLink} from './persistLink';
import {wsLink} from './wsLink';

// create a link that sends •subscriptions• to wsLink, and •queries/mutations• to httpLink
const transportLink = split(
  ({query}) => {
    const def = getMainDefinition(query);
    return (
      def.kind === 'OperationDefinition' && def.operation === 'subscription'
    );
  },
  wsLink,
  httpLink,
);

// Combine links: errorLink comes first to catch errors from subsequent links
export const link = ApolloLink.from([
  persistLink,
  errorLink,
  authLink,
  consoleLink,
  transportLink,
]);
