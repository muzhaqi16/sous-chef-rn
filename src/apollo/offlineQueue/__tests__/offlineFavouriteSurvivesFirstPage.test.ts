import { gql } from '@apollo/client';
import { makeCache } from '#/apollo/cache';
import { queueStore } from '../queueStore';
import {
  makeQueuedMutation,
  queuedMutationFor,
} from '#/test-utils/queuedMutation';
import { AddRecipeToFavoritesDocument } from '#features/recipes/graphql/recipe.generated';

const SAVED = gql`
  query SavedIds {
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

describe('an offline favourite and a first-page read', () => {
  afterEach(() => {
    queueStore.clearAllQueues();
  });

  it('keeps the favourite in the saved list until its write is delivered', () => {
    queueStore.setCurrentUserId('user-1');
    queueStore.addMutation(
      makeQueuedMutation({
        ...queuedMutationFor(AddRecipeToFavoritesDocument),
        variables: { input: { id: 'saved-offline', recipeId: 'recipe-1' } },
      }),
    );
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
});
