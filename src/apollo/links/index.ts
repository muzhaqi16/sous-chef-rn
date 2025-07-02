import {ApolloLink} from '@apollo/client';

import {authLink} from './authLink';
import {consoleLink} from './consoleLink';
import {errorLink} from './errorLink';
import {httpLink} from './httpLink';
import {persistLink} from './persistLink';

// Combine links: errorLink comes first to catch errors from subsequent links
export const link = ApolloLink.from([
  persistLink,
  errorLink,
  authLink,
  consoleLink,
  httpLink,
]);
