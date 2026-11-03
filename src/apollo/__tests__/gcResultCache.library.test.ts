/**
 * After `cache.evict` + `cache.gc()`, the installed Apollo shows a watched
 * query and a fresh read the same result with or without `resetResultCache`:
 * a read depends on each entity's existence, which `evict` dirties, so no
 * memoized result outlives the eviction. So the `cache.gc` wrapper in
 * `../client.ts` and `safeEvict` / `safeEvictMany` (`../utils/cacheUpdaters.ts`)
 * run a plain `gc()`; the reset would only make every watcher re-read cold.
 *
 * Verified: #apollo-gc-needs-no-result-cache-reset-to-drop-evicted-entities
 */
import {
  ApolloClient,
  ApolloLink,
  gql,
  type ObservableQuery,
  type TypedDocumentNode,
} from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { seedQuery } from '#/test-utils/apolloMockProvider';

type ListData = {
  probeList: {
    __typename: string;
    id: string;
    items: {
      __typename: string;
      id: string;
      name: string;
      unit: { __typename: string; id: string; name: string };
    }[];
  };
};

const LIST: TypedDocumentNode<ListData> = gql`
  query GcProbeList {
    probeList {
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

const ITEM: TypedDocumentNode<
  { probeItem: { id: string; name: string } | null },
  { id: string }
> = gql`
  query GcProbeItem($id: ID!) {
    probeItem(id: $id) {
      id
      name
    }
  }
`;

const makeClient = () => {
  const cache = makeCache();
  cache.policies.addTypePolicies({
    Query: {
      fields: {
        probeItem: {
          read: (_, { args, toReference }) =>
            toReference({ __typename: 'GcProbeItem', id: args?.id }),
        },
      },
    },
  });
  seedQuery(cache, {
    query: LIST,
    data: {
      probeList: {
        __typename: 'GcProbeList',
        id: 'L',
        items: [0, 1, 2].map(i => ({
          __typename: 'GcProbeItem',
          id: `i${i}`,
          name: `Item ${i}`,
          unit: { __typename: 'GcProbeUnit', id: `u${i}`, name: `U${i}` },
        })),
      },
    },
  });
  const client = new ApolloClient({
    cache,
    link: ApolloLink.empty(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });
  return { client, cache };
};

const subscriptions: { unsubscribe: () => void }[] = [];

afterEach(() => {
  subscriptions.splice(0).forEach(subscription => subscription.unsubscribe());
});

const watchList = (client: ApolloClient) => {
  const results: ObservableQuery.Result<ListData>[] = [];
  subscriptions.push(
    client
      .watchQuery({
        query: LIST,
        fetchPolicy: 'cache-only',
        nextFetchPolicy: 'cache-only',
      })
      .subscribe(result => {
        results.push(result);
      }),
  );
  return results;
};

/**
 * A cache write schedules each affected watcher's re-read on a timer; a
 * broadcast delivers it now (a cache-only query is not refetched), so the
 * emissions are complete when this resolves.
 */
const deliverBroadcast = (client: ApolloClient) =>
  client.refetchObservableQueries();

const listIds = (
  data: {
    probeList?: { items?: ({ id?: string } | undefined)[] };
  } | null = null,
) => data?.probeList?.items?.map(item => item?.id);

describe.each([
  ['a plain gc()', undefined],
  ['gc({ resetResultCache: true })', { resetResultCache: true }],
])('evict + %s', (_label, gcOptions) => {
  it('drops an evicted list row from the watcher and from a fresh read', async () => {
    const { client, cache } = makeClient();
    const results = watchList(client);
    await deliverBroadcast(client);
    expect(results).toHaveLength(1);

    cache.evict({ id: 'GcProbeItem:i1' });
    cache.gc(gcOptions);
    await deliverBroadcast(client);

    expect(results).toHaveLength(2);
    expect(listIds(results.at(-1)?.data)).toEqual(['i0', 'i2']);
    expect(listIds(client.readQuery({ query: LIST }))).toEqual(['i0', 'i2']);
    expect(
      client.readQuery({ query: ITEM, variables: { id: 'i1' } }),
    ).toBeNull();
  });

  it('leaves the watcher and a fresh read empty over a dangling singular ref', async () => {
    const { client, cache } = makeClient();
    const results = watchList(client);
    await deliverBroadcast(client);

    cache.evict({ id: 'GcProbeUnit:u0' });
    cache.gc(gcOptions);
    await deliverBroadcast(client);

    expect(results.at(-1)?.dataState).toBe('empty');
    expect(client.readQuery({ query: LIST })).toBeNull();
  });
});
