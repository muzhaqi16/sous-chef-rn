import { ApolloClient } from '@apollo/client';
import { link } from './links';
import { makeCache } from './cache';
// import {loadErrorMessages, loadDevMessages} from '@apollo/client/dev';

// if (__DEV__) {
//   loadDevMessages();
//   loadErrorMessages();
// }

const cache = makeCache();

export const client = new ApolloClient({
  link,
  cache,
  // Optimized default fetch policies for performance
  defaultOptions: {
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'ignore',
    },
  },
  // Enable query deduplication for performance
  queryDeduplication: true,
  // Optimize cache operations
  assumeImmutableResults: true,
});
