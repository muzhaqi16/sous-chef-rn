/**
 * A recipe forked offline sits in the recipe list under the id the fork minted.
 * A background refetch of that list answers before the fork replays, so the
 * page is authoritative yet lacks the fork; the queued write keeps its row.
 */
import { gql, type TypedDocumentNode } from '@apollo/client';
import { makeCache } from '../cache';
import { queueStore } from '../offlineQueue/queueStore';
import { QueueStatus } from '../offlineQueue/types';
import { queuedMutationFor } from '#/test-utils/queuedMutation';
import { ForkRecipeDocument } from '#features/recipes/graphql/recipe.generated';

interface RecipeListResult {
  recipes: {
    __typename: 'RecipeConnection';
    totalCount: number;
    edges: {
      __typename: 'RecipeEdge';
      cursor: string;
      node: { __typename: 'Recipe'; id: string; name: string };
    }[];
    pageInfo: {
      __typename: 'PageInfo';
      hasNextPage: boolean;
      endCursor: string | null;
    };
  };
}

const RECIPE_LIST: TypedDocumentNode<RecipeListResult> = gql`
  query RecipeListRefetch {
    recipes(first: 25) {
      totalCount
      edges {
        cursor
        node {
          id
          name
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const page = (recipes: { id: string; name: string }[]): RecipeListResult => ({
  recipes: {
    __typename: 'RecipeConnection',
    totalCount: recipes.length,
    edges: recipes.map(recipe => ({
      __typename: 'RecipeEdge',
      cursor: `c-${recipe.id}`,
      node: { __typename: 'Recipe', ...recipe },
    })),
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
  },
});

const listedIds = (cache: ReturnType<typeof makeCache>) =>
  cache
    .readQuery({ query: RECIPE_LIST })
    ?.recipes.edges.map(edge => edge.node.id);

const queueFork = () =>
  queueStore.addMutation({
    id: 'mut-fork',
    userId: 'user-1',
    ...queuedMutationFor(ForkRecipeDocument),
    variables: { input: { id: 'source-1', newRecipeId: 'fork-1' } },
    status: QueueStatus.PENDING,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    retryCount: 0,
    maxRetries: 3,
    requiresAuth: true,
  });

describe('a recipe-list refetch while a fork is queued', () => {
  beforeEach(() => {
    queueStore.clearAllQueues();
    queueStore.setCurrentUserId('user-1');
  });
  afterEach(() => {
    queueStore.clearAllQueues();
    queueStore.clearCurrentUserId();
  });

  const refetchWithoutFork = () => {
    const cache = makeCache();
    cache.writeQuery({
      query: RECIPE_LIST,
      data: page([
        { id: 'fork-1', name: 'Soup (copy)' },
        { id: 'source-1', name: 'Soup' },
      ]),
    });
    cache.writeQuery({
      query: RECIPE_LIST,
      data: page([{ id: 'source-1', name: 'Soup' }]),
    });
    return cache;
  };

  it('keeps the pending fork', () => {
    queueFork();

    expect(listedIds(refetchWithoutFork())).toEqual(['fork-1', 'source-1']);
  });

  it('drops a row no queued write holds', () => {
    expect(listedIds(refetchWithoutFork())).toEqual(['source-1']);
  });
});
