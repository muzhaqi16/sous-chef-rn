import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { DeleteRecipeDocument } from '#features/recipes/graphql/recipe.generated';
import { useDeleteRecipe } from '../useDeleteRecipe';

const LIST_FIELD = 'recipes({"first":20})';

const heldLists = (cache: ReturnType<typeof makeCache>): string[] =>
  Object.keys(cache.extract().ROOT_QUERY ?? {}).filter(key =>
    key.startsWith('recipes'),
  );

const seeded = () => {
  const cache = makeCache();
  cache.restore({
    ROOT_QUERY: {
      __typename: 'Query',
      [LIST_FIELD]: {
        __typename: 'RecipeConnection',
        edges: [
          {
            __typename: 'RecipeEdge',
            cursor: 'c1',
            node: { __ref: 'Recipe:recipe-1' },
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: 'c1',
        },
      },
    },
    'Recipe:recipe-1': { __typename: 'Recipe', id: 'recipe-1' },
  });
  return cache;
};

describe('useDeleteRecipe', () => {
  it('re-reads the lists when the server refuses, so the recipe shows again', async () => {
    const cache = seeded();
    const refused = recordMock(DeleteRecipeDocument, {
      data: {
        deleteRecipe: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not yours',
        },
      },
    });
    const { result } = renderHookWithApollo(() => useDeleteRecipe(), {
      cache,
      operationMocks: [refused.mock],
    });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteRecipe('recipe-1');
    });

    expect(deleted).toBe(false);
    expect(heldLists(cache)).toEqual([]);
  });

  it('keeps the lists it removed the recipe from once the delete lands', async () => {
    const cache = seeded();
    const landed = recordMock(DeleteRecipeDocument, {
      data: {
        deleteRecipe: {
          __typename: 'DeleteRecipePayload',
          converged: false,
          recipe: { __typename: 'Recipe', id: 'recipe-1' },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useDeleteRecipe(), {
      cache,
      operationMocks: [landed.mock],
    });

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteRecipe('recipe-1');
    });

    expect(deleted).toBe(true);
    expect(heldLists(cache)).toEqual([LIST_FIELD]);
  });
});
