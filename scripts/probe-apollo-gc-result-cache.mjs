/**
 * Does `cache.gc()` need `resetResultCache: true` for correctness, or only to
 * free memory? `src/apollo/client.ts` forces it on every gc.
 *
 *   node scripts/probe-apollo-gc-result-cache.mjs
 *
 * For each mode (default gc / forced reset) it evicts an entity a watched list
 * references, gcs, and reports what the watcher and a fresh read see. Then it
 * times a gc over a populated cache and the re-read of N active watchers.
 */
import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
console.log(
  `@apollo/client ${require('@apollo/client/package.json').version}\n`,
);

const LIST = gql`
  query List {
    list {
      id
      items {
        id
        name
        unit {
          id
          name
        }
      }
    }
  }
`;

const ITEM = gql`
  query Item($id: ID!) {
    item(id: $id) {
      id
      name
    }
  }
`;

function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            item: {
              read: (_, { args, toReference }) =>
                toReference({ __typename: 'Item', id: args?.id }),
            },
          },
        },
      },
    }),
    link: new ApolloLink(() => Observable.of({ data: null })),
  });
}

function seed(client, n) {
  client.writeQuery({
    query: LIST,
    data: {
      list: {
        __typename: 'List',
        id: 'L',
        items: Array.from({ length: n }, (_, i) => ({
          __typename: 'Item',
          id: `i${i}`,
          name: `Item ${i}`,
          unit: { __typename: 'Unit', id: `u${i % 7}`, name: `U${i % 7}` },
        })),
      },
    },
  });
}

async function correctness(forceReset) {
  const client = makeClient();
  seed(client, 3);
  const emissions = [];
  const sub = client
    .watchQuery({ query: LIST, fetchPolicy: 'cache-only' })
    .subscribe(r => emissions.push(r));
  await new Promise(r => setTimeout(r, 0));

  client.cache.evict({ id: 'Item:i1' });
  client.cache.gc(forceReset ? { resetResultCache: true } : undefined);
  await new Promise(r => setTimeout(r, 0));

  const last = emissions.at(-1);
  const fresh = client.readQuery({ query: LIST });
  const byId = client.readQuery({ query: ITEM, variables: { id: 'i1' } });
  sub.unsubscribe();

  // A singular field left pointing at an evicted entity.
  const unitSub = [];
  const s2 = client
    .watchQuery({ query: LIST, fetchPolicy: 'cache-only' })
    .subscribe(r => unitSub.push(r));
  await new Promise(r => setTimeout(r, 0));
  client.cache.evict({ id: 'Unit:u0' });
  client.cache.gc(forceReset ? { resetResultCache: true } : undefined);
  await new Promise(r => setTimeout(r, 0));
  const unitLast = unitSub.at(-1);
  const unitFresh = client.readQuery({ query: LIST });
  s2.unsubscribe();

  const ids = x => x?.list?.items?.map(i => i?.id ?? '<dangling>').join(',');
  console.log(`${forceReset ? 'forced reset' : 'default gc  '}`);
  console.log(`  watcher emissions        -> ${emissions.length}`);
  console.log(
    `  watcher's last list      -> ${ids(last?.data) ?? '<no data>'}`,
  );
  console.log(`  fresh readQuery list     -> ${ids(fresh) ?? '<null>'}`);
  console.log(
    `  read of evicted by id    -> ${
      byId === null ? 'null' : JSON.stringify(byId)
    }`,
  );
  console.log(
    `  singular dangling ref    -> watcher ${unitLast?.dataState}, fresh ${
      unitFresh === null ? 'null' : 'data'
    }`,
  );
}

async function cost(forceReset, n, watchers) {
  const client = makeClient();
  seed(client, n);
  const subs = [];
  for (let w = 0; w < watchers; w++) {
    subs.push(
      client
        .watchQuery({
          query: ITEM,
          variables: { id: `i${w}` },
          fetchPolicy: 'cache-only',
        })
        .subscribe(() => {}),
    );
  }
  subs.push(
    client
      .watchQuery({ query: LIST, fetchPolicy: 'cache-only' })
      .subscribe(() => {}),
  );
  await new Promise(r => setTimeout(r, 0));

  const samples = [];
  for (let k = 0; k < 20; k++) {
    client.cache.evict({ id: `Item:i${n - 1 - k}` });
    const t0 = performance.now();
    client.cache.gc(forceReset ? { resetResultCache: true } : undefined);
    // The broadcast re-reads every watcher; a read after a reset starts cold.
    client.readQuery({ query: LIST });
    for (let w = 0; w < watchers; w++) {
      client.readQuery({ query: ITEM, variables: { id: `i${w}` } });
    }
    samples.push(performance.now() - t0);
  }
  subs.forEach(s => s.unsubscribe());
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  return median;
}

await correctness(false);
await correctness(true);

console.log('\ncost of gc + re-read (median of 20, node, not a device):');
for (const [n, watchers] of [
  [500, 50],
  [2000, 200],
]) {
  const plain = await cost(false, n, watchers);
  const reset = await cost(true, n, watchers);
  console.log(
    `  ${n} entities, ${watchers} watchers -> default ${plain.toFixed(
      2,
    )} ms, forced reset ${reset.toFixed(2)} ms`,
  );
}
