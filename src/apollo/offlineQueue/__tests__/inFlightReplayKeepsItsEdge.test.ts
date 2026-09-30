import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { queueStore } from '../queueStore';
import { QueueStatus } from '../types';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { AddRecipeToFavoritesDocument } from '#features/recipes/graphql/recipe.generated';

const SAVED = gql`
  query SavedIdsInFlight {
    me {
      id
      savedRecipesConnection(first: 20) {
        edges {
          node {
            id
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  }
`;

const page = (ids: string[]) => ({
  me: {
    __typename: 'User',
    id: 'user-1',
    savedRecipesConnection: {
      __typename: 'SavedRecipesConnection',
      edges: ids.map(id => ({
        __typename: 'SavedRecipeEdge',
        node: { __typename: 'SavedRecipe', id },
      })),
      pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
      totalCount: ids.length,
    },
  },
});

const queueCreate = (status: QueueStatus): void => {
  queueStore.setCurrentUserId('user-1');
  const mutation = makeQueuedMutation({
    ...queuedMutationFor(AddRecipeToFavoritesDocument),
    variables: { input: { id: 'saved-offline', recipeId: 'recipe-1' } },
  });
  queueStore.addMutation(mutation);
  queueStore.updateMutation(mutation.id, { status });
};

describe('a create whose replay is in flight', () => {
  afterEach(() => {
    queueStore.clearAllQueues();
  });

  it('counts as unconfirmed while PROCESSING', () => {
    queueCreate(QueueStatus.PROCESSING);

    expect(queueStore.getUnconfirmedCreateIds()).toEqual(
      new Set(['saved-offline']),
    );
  });

  it('keeps its edge when a first page lands before the replay answers', () => {
    queueCreate(QueueStatus.PROCESSING);
    const cache = makeCache();
    cache.writeQuery({
      query: SAVED,
      data: page(['saved-1', 'saved-offline']),
    });

    cache.writeQuery({ query: SAVED, data: page(['saved-1']) });

    const read = cache.readQuery<ReturnType<typeof page>>({ query: SAVED });
    expect(
      read?.me.savedRecipesConnection.edges.map(edge => edge.node.id),
    ).toEqual(expect.arrayContaining(['saved-1', 'saved-offline']));
  });

  it('lets the first page drop it once the replay has landed', () => {
    queueCreate(QueueStatus.SUCCESS);
    const cache = makeCache();
    cache.writeQuery({
      query: SAVED,
      data: page(['saved-1', 'saved-offline']),
    });

    cache.writeQuery({ query: SAVED, data: page(['saved-1']) });

    const read = cache.readQuery<ReturnType<typeof page>>({ query: SAVED });
    expect(
      read?.me.savedRecipesConnection.edges.map(edge => edge.node.id),
    ).toEqual(['saved-1']);
  });
});
