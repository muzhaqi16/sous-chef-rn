/**
 * Under the app's watch defaults (`../defaultOptions.ts`), the installed Apollo
 * reports `loading: true` on a query's first result even when the cache answers
 * it completely, and again on every remount: `nextFetchPolicy` rewrites only
 * the ObservableQuery that settled, and `useQuery` builds one per mount. With
 * `returnPartialData: false` an incomplete read yields NO data. CLAUDE.md's
 * "gate a screen on `loading && !data`" rests on all three.
 *
 * The link never answers: a request in flight.
 *
 * Verified: #apollo-reports-loading-true-on-every-mount-warm-cache-or-not
 */
import {
  ApolloClient,
  ApolloLink,
  Observable,
  gql,
  type ObservableQuery,
  type TypedDocumentNode,
} from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { seedQuery } from '#/test-utils/apolloMockProvider';

type Profile = {
  probeMe: { id: string; firstName: string; lastName: string };
};

const PROFILE: TypedDocumentNode<Profile> = gql`
  query LoadingProbeProfile {
    probeMe {
      id
      firstName
      lastName
    }
  }
`;

const COMPLETE = {
  probeMe: {
    __typename: 'LoadingProbeUser',
    id: 'u1',
    firstName: 'Ada',
    lastName: 'Lovelace',
  },
};

const makeClient = () =>
  new ApolloClient({
    link: new ApolloLink(() => new Observable(() => {})),
    cache: makeCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
  });

const subscriptions: { unsubscribe: () => void }[] = [];

afterEach(() => {
  subscriptions.splice(0).forEach(subscription => subscription.unsubscribe());
});

/** What a `useQuery` mount does: a new watchQuery, subscribed, read at once. */
const mount = (client: ApolloClient) => {
  const observable: ObservableQuery<Profile> = client.watchQuery({
    query: PROFILE,
  });
  // `nextFetchPolicy` rewrites this as soon as the first result settles.
  const startedAt = observable.options.fetchPolicy;
  subscriptions.push(observable.subscribe({ next: () => {}, error: () => {} }));
  return { observable, startedAt, result: observable.getCurrentResult() };
};

describe('loading on a mount under the app watch defaults', () => {
  it('is true over a cache that answers the query completely', () => {
    const client = makeClient();
    seedQuery(client.cache, { query: PROFILE, data: COMPLETE });

    const first = mount(client);

    expect(first.startedAt).toBe('cache-and-network');
    expect(first.result.loading).toBe(true);
    expect(first.result.data).toEqual(COMPLETE);
    expect(first.observable.options.fetchPolicy).toBe('cache-first');
  });

  it('is true again on a remount, after the first mount settled', () => {
    const client = makeClient();
    seedQuery(client.cache, { query: PROFILE, data: COMPLETE });
    const first = mount(client);
    expect(first.observable.options.fetchPolicy).toBe('cache-first');

    const second = mount(client);

    expect(second.startedAt).toBe('cache-and-network');
    expect(second.result.loading).toBe(true);
  });

  it('comes with no data at all when the cache lacks one selected field', () => {
    const client = makeClient();
    seedQuery(client.cache, {
      query: gql`
        query LoadingProbeNarrowProfile {
          probeMe {
            id
            firstName
          }
        }
      `,
      data: {
        probeMe: { __typename: 'LoadingProbeUser', id: 'u1', firstName: 'Ada' },
      },
    });

    const { result } = mount(client);

    expect(result.loading).toBe(true);
    expect(result.data).toBeUndefined();
  });
});
