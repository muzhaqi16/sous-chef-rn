// The client-wide Apollo default options.
//
// Deliberately its OWN module rather than an export from `client.ts`: that file
// constructs the client singleton and registers it with the refresh-token link
// at import time, so a test importing this constant from there would drag those
// side effects in (and did — two link suites failed on a mocked
// `registerApolloClient`). A constant should not pull a singleton behind it.

import type { ApolloClient } from '@apollo/client';

/**
 * The client-wide default options, exported so a test client can be built with
 * the SAME behaviour as production.
 *
 * Apollo 4.2's modern signatures make `defaultOptions` a required, fully
 * declared shape (see `src/types/apollo-default-options.d.ts`), which surfaced
 * that several test clients were constructed with none at all — they ran
 * without `errorPolicy: 'all'`, so a failing operation THREW there while it
 * resolves with `{ data, error }` in the app. Sharing one definition removes
 * that class of divergence instead of restating it per suite.
 */
export const APOLLO_DEFAULT_OPTIONS: ApolloClient.DefaultOptions.Input = {
  query: {
    fetchPolicy: 'network-only', // Always fetch fresh data for one-time queries
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
    // Stated rather than left to the default, because it is the single
    // assumption the offline-first design rests on: an incomplete cache read
    // yields NO data (not a partial object) and goes to the network. That is
    // why every optimistic entity must be written complete for every query that
    // reads it — `buildOptimisticPantryItem`, `writePantryItemDetailStub` and
    // `__tests__/apollo/optimisticEntityCompleteness.test.ts` all exist to hold
    // that line. Flipping this to `true` is an architectural change, not a
    // tweak: `data` becomes partial everywhere and each consumer takes on the
    // missing-field handling instead.
    returnPartialData: false,
  },
};
