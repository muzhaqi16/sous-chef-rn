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
  // Optimized default fetch policies for performance and offline support
  defaultOptions: {
    query: {
      fetchPolicy: 'cache-first',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
    watchQuery: {
      // Changed from 'cache-and-network' to 'cache-first' to prevent unnecessary
      // refetches when cache is already updated by mutations. Queries that need
      // fresh data can explicitly override with fetchPolicy: 'cache-and-network'
      fetchPolicy: 'cache-first',
      errorPolicy: 'ignore',
    },
  },
  // Enable query deduplication for performance
  queryDeduplication: true,
  // Optimize cache operations
  assumeImmutableResults: true,
});
