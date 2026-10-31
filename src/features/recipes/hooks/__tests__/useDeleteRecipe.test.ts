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

type HeldList = { edges: { node: { __ref: string } }[] };

const listed = (cache: ReturnType<typeof makeCache>) => {
  const root: { [field: string]: unknown } =
    cache.extract(true).ROOT_QUERY ?? {};
  const list = root[LIST_FIELD] as HeldList | undefined;
  return list?.edges.map(edge => edge.node.__ref);
};

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
  it('takes the recipe off the list before the server answers', async () => {
    const cache = seeded();
    const held = recordMock(DeleteRecipeDocument, {
      data: {
        deleteRecipe: {
          __typename: 'DeleteRecipePayload',
          converged: false,
          recipe: { __typename: 'Recipe', id: 'recipe-1' },
        },
      },
      held: true,
    });
    const { result } = renderHookWithApollo(() => useDeleteRecipe(), {
      cache,
      operationMocks: [held.mock],
    });

    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.deleteRecipe('recipe-1');
    });
    expect(listed(cache)).toEqual([]);

    await act(async () => {
      held.release();
      await pending;
    });
    expect(listed(cache)).toEqual([]);
  });

  it('ends on the server list when refused, so the recipe shows again', async () => {
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
    expect(listed(cache)).toEqual(['Recipe:recipe-1']);
  });

  it('keeps it off the list once the delete lands', async () => {
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
    expect(listed(cache)).toEqual([]);
  });
});
