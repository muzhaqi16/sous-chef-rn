import { ApolloClient, ApolloLink, gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import { FavoritesViewerDocument } from '#features/recipes/cache/favorites.generated';
import { performOptimisticUnfavorite } from '../optimisticUnfavorite';
import { seedFragment, seedQuery } from '#/test-utils/apolloMockProvider';

const SAVED_LIST_WITH_COUNT = gql`
  fragment _TestSavedListWithCount on User {
    id
    savedRecipesConnection(first: 20) {
      edges {
        node {
          id
          recipeId
        }
      }
      totalCount
    }
  }
`;

const SAVED_LIST = gql`
  fragment _TestSavedList on User {
    id
    savedRecipesConnection(first: 20) {
      edges {
        node {
          id
          recipeId
        }
      }
    }
  }
`;

const edge = (recipeId: string) => ({
  __typename: 'SavedRecipeEdge',
  node: { __typename: 'SavedRecipe', id: `saved-${recipeId}`, recipeId },
});

const APPLIED = {
  data: {
    removeRecipeFromFavorites: {
      __typename: 'RemoveRecipeFromFavoritesPayload',
      savedRecipe: { __typename: 'SavedRecipe', id: 'saved-r1' },
    },
  },
};

const REFUSED = {
  data: {
    removeRecipeFromFavorites: {
      __typename: 'ForbiddenError',
      code: ErrorCode.Forbidden,
    },
  },
};

/** A viewer whose saved list holds r1 and r2, cached with `totalCount` or without. */
function setUp(totalCount?: number | null) {
  const cache = makeCache();
  const client = new ApolloClient({
    cache,
    dataMasking: true,
    defaultOptions: APOLLO_DEFAULT_OPTIONS,
    link: ApolloLink.empty(),
  });
  seedQuery(cache, {
    query: FavoritesViewerDocument,
    data: { __typename: 'Query', me: { __typename: 'User', id: 'u1' } },
  });
  const edges = [edge('r1'), edge('r2')];
  const connection = { __typename: 'SavedRecipeConnection', edges };
  seedFragment(
    cache,
    totalCount === undefined
      ? {
          id: 'User:u1',
          fragment: SAVED_LIST,
          data: {
            __typename: 'User',
            id: 'u1',
            savedRecipesConnection: connection,
          },
        }
      : {
          id: 'User:u1',
          fragment: SAVED_LIST_WITH_COUNT,
          data: {
            __typename: 'User',
            id: 'u1',
            savedRecipesConnection: { ...connection, totalCount },
          },
        },
  );
  return { cache, client };
}

/** The stored list, as the cache holds it. */
const storedList = (cache: ReturnType<typeof makeCache>) => {
  const user = cache.extract()['User:u1'] ?? {};
  const [field] = Object.entries(user).filter(([key]) =>
    key.startsWith('savedRecipesConnection'),
  );
  return field?.[1] as { totalCount?: number | null; edges: unknown[] };
};

const unsave = (
  client: ApolloClient,
  result: typeof APPLIED | typeof REFUSED = APPLIED,
) =>
  performOptimisticUnfavorite({
    client,
    recipeId: 'r1',
    mutate: () => Promise.resolve(result),
    fallback: 'failed',
    present: () => {},
  });

describe('performOptimisticUnfavorite', () => {
  it('leaves a list cached without a count without one', async () => {
    const { cache, client } = setUp();

    await unsave(client);

    const list = storedList(cache);
    expect(list.edges).toHaveLength(1);
    expect(list).not.toHaveProperty('totalCount');
  });

  it('keeps a count the server reported as unavailable', async () => {
    const { cache, client } = setUp(null);

    await unsave(client);

    expect(storedList(cache).totalCount).toBeNull();
  });

  it('moves a held count down by one, never below zero', async () => {
    const held = setUp(3);
    await unsave(held.client);
    expect(storedList(held.cache).totalCount).toBe(2);

    const empty = setUp(0);
    await unsave(empty.client);
    expect(storedList(empty.cache).totalCount).toBe(0);
  });

  it('restores the list when the server refuses', async () => {
    const { cache, client } = setUp(3);

    await expect(unsave(client, REFUSED)).resolves.toBe(false);

    const list = storedList(cache);
    expect(list.edges).toHaveLength(2);
    expect(list.totalCount).toBe(3);
  });
});
