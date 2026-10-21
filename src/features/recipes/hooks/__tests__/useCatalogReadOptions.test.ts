import { makeCache } from '#/apollo/cache';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  catalogFetchKey,
  recordCatalogFetch,
  useCatalogFetchTimesStore,
} from '#features/recipes/store/catalogFetchTimes';
import { useCatalogReadOptions } from '../useCatalogReadOptions';
import {
  RandomCatalogRecipesDocument,
  type RandomCatalogRecipesQuery,
  type RandomCatalogRecipesQueryVariables,
} from '../useCatalogDiscovery.generated';

const DAY_MS = 24 * 60 * 60 * 1000;

const VARIABLES: RandomCatalogRecipesQueryVariables = {
  diets: [],
  intolerances: [],
  first: 25,
};
const KEY = catalogFetchKey('randomCatalogRecipes', VARIABLES);

const page = (catalogAvailable: boolean): RandomCatalogRecipesQuery => ({
  __typename: 'Query',
  randomCatalogRecipes: {
    __typename: 'CatalogRecipeConnection',
    catalogAvailable,
    edges: catalogAvailable
      ? [
          {
            __typename: 'CatalogRecipeEdge',
            cursor: '1',
            node: {
              __typename: 'CatalogRecipeHit',
              provider: ExternalSource.Spoonacular,
              providerRecipeId: '1',
              name: 'Stew',
              imageUrl: null,
              servings: 2,
              totalTimeMinutes: null,
              likes: null,
            },
          },
        ]
      : [],
  },
});

/** A cache holding a page; a complete one records its arrival as it is written. */
const holding = (catalogAvailable: boolean) => {
  const cache = makeCache();
  cache.writeQuery({
    query: RandomCatalogRecipesDocument,
    variables: VARIABLES,
    data: page(catalogAvailable),
  });
  return cache;
};

const render = (
  cache: ReturnType<typeof makeCache>,
  initialProps: { variables: RandomCatalogRecipesQueryVariables | null },
) =>
  renderHookWithApollo(
    ({ variables }: { variables: RandomCatalogRecipesQueryVariables | null }) =>
      useCatalogReadOptions(RandomCatalogRecipesDocument, variables, {
        field: 'randomCatalogRecipes',
        maxAgeMs: DAY_MS,
        pageOf: data => data.randomCatalogRecipes,
      }).fetchPolicy,
    { cache, initialProps },
  );

beforeEach(() => {
  useCatalogFetchTimesStore.setState({ fetchedAt: {} });
});

describe('useCatalogReadOptions', () => {
  it('answers from the cache for a complete page inside its window', () => {
    const cache = holding(true);
    recordCatalogFetch(KEY, Date.now() - 2 * 60 * 60 * 1000);

    expect(render(cache, { variables: VARIABLES }).result.current).toBe(
      'cache-first',
    );
  });

  it('shows a page past its window while asking for it again', () => {
    const cache = holding(true);
    recordCatalogFetch(KEY, Date.now() - 25 * 60 * 60 * 1000);

    expect(render(cache, { variables: VARIABLES }).result.current).toBe(
      'cache-and-network',
    );
  });

  it('shows a page with no recorded arrival while asking for it again', () => {
    const cache = holding(true);
    useCatalogFetchTimesStore.setState({ fetchedAt: {} });

    expect(render(cache, { variables: VARIABLES }).result.current).toBe(
      'cache-and-network',
    );
  });

  it('asks again, unseen, for a page held from when the catalog was down', () => {
    expect(
      render(holding(false), { variables: VARIABLES }).result.current,
    ).toBe('network-only');
  });

  it('lets `cache-first` ask when nothing is held', () => {
    expect(render(makeCache(), { variables: VARIABLES }).result.current).toBe(
      'cache-first',
    );
  });

  it('decides once per variables, so a degraded answer is not asked for again', () => {
    const cache = holding(false);
    const { result, rerender } = render(cache, { variables: VARIABLES });

    cache.writeQuery({
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(true),
    });
    rerender({ variables: { ...VARIABLES } });

    expect(result.current).toBe('network-only');
  });

  it('decides again for new variables', () => {
    const { result, rerender } = render(holding(false), {
      variables: VARIABLES,
    });

    rerender({ variables: { ...VARIABLES, first: 10 } });

    expect(result.current).toBe('cache-first');
  });

  it('asks nothing for null variables', () => {
    expect(render(holding(false), { variables: null }).result.current).toBe(
      'cache-first',
    );
  });
});
