/**
 * With `dataMasking`, the installed Apollo does not re-emit a query when the
 * only field that changed sits behind a fragment spread, and its `data` keeps
 * its identity, so a render-time `readFragment` the React Compiler memoizes on
 * that data stays stale. `watchFragment` (what `useFragment` and
 * `useFragmentList` run) sees the edit. Selecting the field inline as well
 * makes the query re-emit. The `renderTimeReadFragment` lint entry holds
 * feature hooks to `useFragment` for this.
 *
 * Verified: #apollo-masked-results-keep-identity-when-only-masked-fields-change
 */
import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

const ROW = gql`
  fragment MaskProbeRow on MaskProbeItem {
    id
    name
  }
`;

const BEHIND_THE_SPREAD = gql`
  query MaskProbeList {
    probeList {
      id
      items {
        id
        ...MaskProbeRow
      }
    }
  }
  ${ROW}
`;

const ALSO_INLINE = gql`
  query MaskProbeSignalList {
    probeList {
      id
      items {
        id
        name
        ...MaskProbeRow
      }
    }
  }
  ${ROW}
`;

const subscriptions: { unsubscribe: () => void }[] = [];

afterEach(() => {
  subscriptions.splice(0).forEach(subscription => subscription.unsubscribe());
});

/** Watches `query`, edits row b's `name` through its fragment, and reports. */
const editRowBehind = async (query: typeof BEHIND_THE_SPREAD) => {
  const client = new ApolloClient({
    cache: makeCache(),
    link: ApolloLink.empty(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    dataMasking: true,
  });
  seedQuery(client.cache, {
    query,
    data: {
      probeList: {
        __typename: 'MaskProbeList',
        id: 'L',
        items: ['a', 'b'].map(id => ({
          __typename: 'MaskProbeItem',
          id,
          name: `old ${id}`,
        })),
      },
    },
  });

  const emitted: unknown[] = [];
  subscriptions.push(
    client
      .watchQuery({
        query,
        fetchPolicy: 'cache-only',
        nextFetchPolicy: 'cache-only',
      })
      .subscribe(result => {
        emitted.push(result.data);
      }),
  );
  // A cache-only query is not refetched, only re-broadcast: this delivers
  // whatever the last write scheduled, so a missing emission is a fact.
  await client.refetchObservableQueries();

  // What the compiler makes of a render-time read: recomputed only when the
  // query's `data` changes identity.
  let memoKey: unknown;
  let memoValue: unknown;
  const renderTimeRead = (data: unknown) => {
    if (data !== memoKey) {
      memoKey = data;
      memoValue = client.cache.readFragment<{ name: string }>({
        fragment: ROW,
        from: { __typename: 'MaskProbeItem', id: 'b' },
      })?.name;
    }
    return memoValue;
  };
  renderTimeRead(emitted.at(-1));

  const live: (string | undefined)[][] = [];
  subscriptions.push(
    client.cache
      .watchFragment<{ name: string }>({
        fragment: ROW,
        from: [
          { __typename: 'MaskProbeItem', id: 'a' },
          { __typename: 'MaskProbeItem', id: 'b' },
        ],
      })
      .subscribe(result => {
        live.push(result.data.map(row => row?.name));
      }),
  );

  const before = emitted.at(-1);
  const emissionsBefore = emitted.length;
  seedFragment(client.cache, {
    fragment: ROW,
    data: { __typename: 'MaskProbeItem', id: 'b', name: 'new b' },
  });
  await client.refetchObservableQueries();
  const after = emitted.at(-1);

  return {
    queryEmitted: emitted.length > emissionsBefore,
    keptIdentity: before === after,
    memoizedRead: renderTimeRead(after),
    watchFragment: live.at(-1),
  };
};

describe('an edit to a row field behind a fragment spread, under dataMasking', () => {
  it('does not re-emit the query, so a memoized render-time read stays stale', async () => {
    expect(await editRowBehind(BEHIND_THE_SPREAD)).toEqual({
      queryEmitted: false,
      keptIdentity: true,
      memoizedRead: 'old b',
      watchFragment: ['old a', 'new b'],
    });
  });

  it('re-emits the query when the field is also selected inline', async () => {
    expect(await editRowBehind(ALSO_INLINE)).toEqual({
      queryEmitted: true,
      keptIdentity: false,
      memoizedRead: 'new b',
      watchFragment: ['old a', 'new b'],
    });
  });
});
