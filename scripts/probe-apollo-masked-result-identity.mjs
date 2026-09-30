/**
 * Under `dataMasking`, does a query re-emit when only a field behind a fragment
 * spread changes? And what does a read memoized on its result then see?
 *
 *   node scripts/probe-apollo-masked-result-identity.mjs
 *
 * Watches a list whose rows are masked behind `...Row`, edits one row's
 * masked field, and reports: whether the query emitted, whether `data` kept
 * its identity, what a `readFragment` memoized on that identity (what the
 * React Compiler does to a render-time read) returns, and what a
 * `watchFragment` with an ARRAY `from` returns. Then repeats with the field
 * also selected inline — the "reactivity signal" workaround.
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

const ROW = gql`
  fragment Row on Item {
    id
    name
  }
`;

const masked = gql`
  query List {
    list {
      id
      items {
        id
        ...Row
      }
    }
  }
  ${ROW}
`;

const withSignal = gql`
  query List {
    list {
      id
      items {
        id
        name
        ...Row
      }
    }
  }
  ${ROW}
`;

const seed = {
  list: {
    __typename: 'List',
    id: 'L',
    items: ['a', 'b'].map(id => ({
      __typename: 'Item',
      id,
      name: `old ${id}`,
    })),
  },
};

const tick = () => new Promise(resolve => setTimeout(resolve, 20));

async function run(label, query) {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: new ApolloLink(() => Observable.of({ data: null })),
    dataMasking: true,
  });
  client.writeQuery({ query, data: seed });

  const emitted = [];
  const sub = client
    .watchQuery({ query, fetchPolicy: 'cache-only' })
    .subscribe(result => emitted.push(result.data));
  await tick();

  // What a compiler-memoized render-time read does: recompute only when the
  // query's `data` changes identity.
  let memoKey;
  let memoValue;
  const renderTimeRead = data => {
    if (data !== memoKey) {
      memoKey = data;
      memoValue = client.cache.readFragment({
        fragment: ROW,
        from: { __typename: 'Item', id: 'b' },
      })?.name;
    }
    return memoValue;
  };
  renderTimeRead(emitted.at(-1));

  const live = [];
  const liveSub = client
    .watchFragment({
      fragment: ROW,
      from: [
        { __typename: 'Item', id: 'a' },
        { __typename: 'Item', id: 'b' },
      ],
    })
    .subscribe(result => live.push(result.data.map(row => row?.name)));
  await tick();

  const before = emitted.at(-1);
  const emissionsBefore = emitted.length;
  client.cache.writeFragment({
    fragment: ROW,
    data: { __typename: 'Item', id: 'b', name: 'new b' },
  });
  await tick();
  const after = emitted.at(-1);

  console.log(label);
  console.log(
    `  query emitted on the edit     -> ${emitted.length > emissionsBefore}`,
  );
  console.log(`  data kept its identity        -> ${before === after}`);
  console.log(`  memoized render-time read     -> ${renderTimeRead(after)}`);
  console.log(
    `  watchFragment, array from     -> ${JSON.stringify(live.at(-1))}`,
  );
  console.log('');

  sub.unsubscribe();
  liveSub.unsubscribe();
}

await run('1. row field behind the spread only', masked);
await run('2. the same field also selected inline (a "signal")', withSignal);
