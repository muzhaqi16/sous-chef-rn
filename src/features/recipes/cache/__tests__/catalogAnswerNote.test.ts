import { ApolloClient, ApolloLink } from '@apollo/client';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createAnswerNotesLink } from '#/apollo/links/answerNotesLink';
import { createOfflineReadLink } from '#/apollo/links/offlineReadLink';
import { useStore } from '#store';
import { noteCatalogAnswer } from '#features/recipes/cache/catalogAnswerNote';
import {
  RandomCatalogRecipesDocument,
  type RandomCatalogRecipesQuery,
} from '#features/recipes/hooks/useCatalogDiscovery.generated';
import {
  catalogFetchedAt,
  catalogFetchKey,
  recordCatalogFetch,
  useCatalogFetchTimesStore,
} from '#features/recipes/store/catalogFetchTimes';
import { seedQuery } from '#/test-utils/apolloMockProvider';

const VARIABLES = { diets: [], intolerances: [], first: 25 };
const KEY = catalogFetchKey('randomCatalogRecipes', VARIABLES);
const DAY_MS = 24 * 60 * 60 * 1000;

const page = (catalogAvailable: boolean): RandomCatalogRecipesQuery => ({
  __typename: 'Query',
  randomCatalogRecipes: {
    __typename: 'CatalogRecipeConnection',
    catalogAvailable,
    edges: [],
  },
});

const clientAnswering = (answer: RandomCatalogRecipesQuery) => {
  const cache = makeCache();
  return new ApolloClient({
    cache,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.from([
      createOfflineReadLink(),
      createAnswerNotesLink([noteCatalogAnswer]),
      new MockLink([
        {
          request: {
            query: RandomCatalogRecipesDocument,
            variables: VARIABLES,
          },
          result: { data: answer },
        },
      ]),
    ]),
  });
};

const read = (client: ApolloClient) =>
  client.query({
    query: RandomCatalogRecipesDocument,
    variables: VARIABLES,
    fetchPolicy: 'network-only',
  });

beforeEach(() => {
  useCatalogFetchTimesStore.setState({ fetchedAt: {} });
  useStore.setState({ isOnline: true, apiReachable: true });
});

describe('when a catalog page arrived', () => {
  it('is recorded when the server answers it complete', async () => {
    const before = Date.now();

    await read(clientAnswering(page(true)));

    expect(catalogFetchedAt(KEY)).toBeGreaterThanOrEqual(before);
  });

  it('stays as it was for a page answered without the catalog', async () => {
    await read(clientAnswering(page(false)));

    expect(catalogFetchedAt(KEY)).toBeUndefined();
  });

  it('stays as it was for a page served from the device offline', async () => {
    const weekOld = Date.now() - 7 * DAY_MS;
    const client = clientAnswering(page(true));
    seedQuery(client.cache, {
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(true),
    });
    recordCatalogFetch(KEY, weekOld);
    useStore.setState({ apiReachable: false });

    await read(client);

    expect(catalogFetchedAt(KEY)).toBe(weekOld);
  });
});
