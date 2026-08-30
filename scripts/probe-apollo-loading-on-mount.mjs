/**
 * Prints what the INSTALLED Apollo Client reports for `loading` on a screen's
 * first render, which is the thing CLAUDE.md's "gate on data, not on loading"
 * rule rests on.
 *
 *   node scripts/probe-apollo-loading-on-mount.mjs
 *
 * Three claims, none of which the type system shows and all of which were
 * assumed rather than checked:
 *
 * 1. `cache-and-network` reports `loading: true` on the FIRST result even when
 *    the cache answers the query completely. A screen gating on `loading`
 *    therefore blanks itself for the whole network leg on a warm cache.
 *
 * 2. `nextFetchPolicy: 'cache-first'` mutates the ObservableQuery it settled
 *    on. `useQuery` builds a new one per mount, so a REMOUNT starts at
 *    `cache-and-network` again — the switch never survives a navigation, and
 *    every visit to a screen is a fresh network leg.
 *
 * 3. With `returnPartialData: false` an INCOMPLETE cache read yields
 *    `data === undefined`, not a partial object. So `loading && !data` really
 *    means "the read was incomplete", and one missing field is enough.
 *
 * The link here never emits, standing in for a request in flight — the state a
 * stalled API leaves the app in for the 10s httpLink abort deadline.
 */
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
console.log(
  `@apollo/client ${require('@apollo/client/package.json').version}\n`,
);

const QUERY = gql`
  query Profile {
    me {
      id
      firstName
      lastName
    }
  }
`;

/** A link that accepts the request and never answers it. */
const stalledLink = new ApolloLink(() => new Observable(() => {}));

const makeClient = () =>
  new ApolloClient({
    link: stalledLink,
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        nextFetchPolicy: 'cache-first',
        errorPolicy: 'all',
        returnPartialData: false,
      },
    },
  });

const COMPLETE = {
  me: { __typename: 'User', id: 'u1', firstName: 'Ada', lastName: 'Lovelace' },
};

const firstResultOf = client => {
  const observable = client.watchQuery({ query: QUERY });
  // Read the policy BEFORE subscribing: `nextFetchPolicy` rewrites
  // `options.fetchPolicy` on this instance as soon as it settles, so reading it
  // afterwards shows where it ended up, not where it started.
  const startedAt = observable.options.fetchPolicy;
  const subscription = observable.subscribe({
    next: () => {},
    error: () => {},
  });
  const result = observable.getCurrentResult();
  return { observable, subscription, result, startedAt };
};

// ---------------------------------------------------------------------------
// 1. Warm cache, first mount
// ---------------------------------------------------------------------------
const client = makeClient();
client.cache.writeQuery({ query: QUERY, data: COMPLETE });

const first = firstResultOf(client);
console.log('1. cache-and-network over a COMPLETE cache, first mount');
console.log(`   started at       -> ${first.startedAt}`);
console.log(`   loading          -> ${first.result.loading}`);
console.log(`   data present     -> ${!!first.result.data}`);
console.log(`   settled to       -> ${first.observable.options.fetchPolicy}`);
console.log(
  `   => a screen gating on \`loading\` blanks here, with the data in hand\n`,
);

// ---------------------------------------------------------------------------
// 2. Remount — a second watchQuery, exactly what useQuery does per mount
// ---------------------------------------------------------------------------
const second = firstResultOf(client);
console.log('2. the SAME query watched again (a remount)');
console.log(`   started at       -> ${second.startedAt}`);
console.log(`   loading          -> ${second.result.loading}`);
console.log(
  `   => the first instance settling to cache-first bought the second nothing;`,
);
console.log(`      every visit is a fresh network leg\n`);

first.subscription.unsubscribe();
second.subscription.unsubscribe();

// ---------------------------------------------------------------------------
// 3. Incomplete cache — one missing field
// ---------------------------------------------------------------------------
const partialClient = makeClient();
partialClient.cache.writeQuery({
  query: gql`
    query PartialProfile {
      me {
        id
        firstName
      }
    }
  `,
  data: { me: { __typename: 'User', id: 'u1', firstName: 'Ada' } },
});

const third = firstResultOf(partialClient);
console.log('3. the same query over a cache missing ONE field (lastName)');
console.log(`   loading          -> ${third.result.loading}`);
console.log(`   data             -> ${third.result.data}`);
console.log(
  `   => returnPartialData:false yields NO data, so \`!data\` == "read was incomplete"`,
);
third.subscription.unsubscribe();
