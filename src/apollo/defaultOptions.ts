// Its own module, not an export from `client.ts`: that file builds the client
// singleton and registers it with the refresh-token link at import time, so
// importing this constant from there drags those side effects into any test
// that wants it. A constant should not pull a singleton behind it.

import type { ApolloClient } from '@apollo/client';

/**
 * Exported so a test client is built with the SAME behaviour as production. A
 * client constructed without these runs without `errorPolicy: 'all'`, so a
 * failing operation THROWS there while it resolves with `{ data, error }` in
 * the app.
 */
export const APOLLO_DEFAULT_OPTIONS: ApolloClient.DefaultOptions.Input = {
  query: {
    // Cache first, so a one-shot read works offline unless the caller says it
    // needs fresh data. `network-only` as the DEFAULT made every imperative
    // read offline-hostile by omission — the opposite of what an offline-first
    // app wants from the option it gets when nobody chose one.
    // `defaultOptions.test.ts` pins this and lists the callers that opt out.
    fetchPolicy: 'cache-first',
    errorPolicy: 'all', // Return both data and errors for observability
  },
  mutate: {
    errorPolicy: 'all', // Mutations need full error info for handling
  },
  watchQuery: {
    // cache-and-network: Fetch from cache immediately, then update from network
    // Provides instant UI while ensuring data freshness
    fetchPolicy: 'cache-and-network',
    // After first fetch, use cache-first to reduce network calls
    nextFetchPolicy: 'cache-first',
    errorPolicy: 'all', // Return both cached data and errors for observability
    // Stated, not defaulted: an incomplete cache read yields NO data (not a
    // partial object) and goes to the network, which is why every optimistic
    // entity must be written complete for every query that reads it. Flipping
    // this to `true` is an architectural change, not a tweak.
    returnPartialData: false,
  },
};
