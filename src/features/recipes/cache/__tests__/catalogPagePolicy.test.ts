import { makeCache } from '#/apollo/cache';
import { ExternalSource } from '#/graphql/generated/schemaTypes';
import {
  RandomCatalogRecipesDocument,
  type RandomCatalogRecipesQuery,
  type RandomCatalogRecipesQueryVariables,
} from '#features/recipes/hooks/useCatalogDiscovery.generated';
import {
  catalogFetchedAt,
  catalogFetchKey,
} from '#features/recipes/store/catalogFetchTimes';
import { seedQuery } from '#/test-utils/apolloMockProvider';

const page = (
  catalogAvailable: boolean,
  ...names: string[]
): RandomCatalogRecipesQuery => ({
  __typename: 'Query',
  randomCatalogRecipes: {
    __typename: 'CatalogRecipeConnection',
    catalogAvailable,
    edges: names.map(name => ({
      __typename: 'CatalogRecipeEdge',
      cursor: name,
      node: {
        __typename: 'CatalogRecipeHit',
        provider: ExternalSource.Spoonacular,
        providerRecipeId: name,
        name,
        imageUrl: null,
        servings: 2,
        totalTimeMinutes: null,
        likes: 0,
      },
    })),
  },
});

const read = (
  cache: ReturnType<typeof makeCache>,
  variables: RandomCatalogRecipesQueryVariables,
) => cache.readQuery({ query: RandomCatalogRecipesDocument, variables });

const VARIABLES: RandomCatalogRecipesQueryVariables = {
  diets: [],
  intolerances: [],
  first: 25,
};
const KEY = catalogFetchKey('randomCatalogRecipes', VARIABLES);

describe('catalog page policy', () => {
  it('keeps a complete page over one answered without the catalog', () => {
    const cache = makeCache();
    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(true, 'stew', 'curry'),
    });
    const held = read(cache, VARIABLES);
    const recordedAt = catalogFetchedAt(KEY);

    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(false),
    });

    const after = read(cache, VARIABLES);
    expect(after).toBe(held);
    expect(after?.randomCatalogRecipes.edges).toHaveLength(2);
    expect(catalogFetchedAt(KEY)).toBe(recordedAt);
  });

  it('holds a degraded page when nothing complete was held', () => {
    const cache = makeCache();
    const variables = { ...VARIABLES, first: 10 };
    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables,
      data: page(false),
    });

    expect(read(cache, variables)?.randomCatalogRecipes).toMatchObject({
      catalogAvailable: false,
      edges: [],
    });
    expect(
      catalogFetchedAt(catalogFetchKey('randomCatalogRecipes', variables)),
    ).toBeUndefined();
  });

  it('replaces a page with the next complete one and records when it came', () => {
    const cache = makeCache();
    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(true, 'stew'),
    });
    const before = Date.now();
    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(true, 'curry'),
    });

    expect(
      read(cache, VARIABLES)?.randomCatalogRecipes.edges.map(
        edge => edge.node.name,
      ),
    ).toEqual(['curry']);
    expect(catalogFetchedAt(KEY)).toBeGreaterThanOrEqual(before);
  });

  it('keeps a page per set of arguments', () => {
    const cache = makeCache();
    const other = { ...VARIABLES, first: 5 };
    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables: VARIABLES,
      data: page(true, 'stew'),
    });
    seedQuery(cache, {
      query: RandomCatalogRecipesDocument,
      variables: other,
      data: page(false),
    });

    expect(read(cache, VARIABLES)?.randomCatalogRecipes.edges).toHaveLength(1);
    expect(read(cache, other)?.randomCatalogRecipes.catalogAvailable).toBe(
      false,
    );
  });
});
