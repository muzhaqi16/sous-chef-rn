import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  Observable,
  gql,
} from '@apollo/client';
import { APOLLO_DEFAULT_OPTIONS } from '../defaultOptions';
import { RESYNC_SCOPE, scopedClient } from '../scopedClient';

const Query = gql`
  query ScopedRead {
    value
  }
`;

const makeClient = () =>
  new ApolloClient({
    cache: new InMemoryCache(),
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: new ApolloLink(
      () =>
        new Observable(observer => {
          observer.next({ data: { value: 'answer' } });
          observer.complete();
        }),
    ),
  });

describe('scopedClient', () => {
  it('names its scope on every query watched through it', () => {
    const client = makeClient();
    const watched = scopedClient(client, 'Pantry').watchQuery({ query: Query });

    expect(watched.options.context).toMatchObject({ [RESYNC_SCOPE]: 'Pantry' });
  });

  it('keeps the context a query states, and the client-wide defaults', () => {
    const client = makeClient();
    const watched = scopedClient(client, 'Pantry').watchQuery({
      query: Query,
      context: { localFirst: true },
    });

    expect(watched.options.context).toEqual({
      localFirst: true,
      [RESYNC_SCOPE]: 'Pantry',
    });
    expect(watched.options).toMatchObject({
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    });
  });

  // A provider rebuilt with a new client would remount every query under it.
  it('is one client per scope', () => {
    const client = makeClient();

    expect(scopedClient(client, 'Pantry')).toBe(scopedClient(client, 'Pantry'));
    expect(scopedClient(client, 'Pantry')).not.toBe(
      scopedClient(client, 'MealPlan'),
    );
  });

  it('is the client itself for everything else', async () => {
    const client = makeClient();
    const scoped = scopedClient(client, 'Pantry');

    await scoped.query({ query: Query });

    expect(scoped.cache).toBe(client.cache);
    expect(client.readQuery({ query: Query })).toEqual({ value: 'answer' });
    expect([...client.getObservableQueries('all')]).toEqual([]);
  });

  it('lists its watched queries among the client’s', () => {
    const client = makeClient();
    const watched = scopedClient(client, 'Pantry').watchQuery({ query: Query });
    const subscription = watched.subscribe(() => {});

    expect([...client.getObservableQueries('active')]).toContain(watched);
    subscription.unsubscribe();
  });
});
