import { act, waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import type { MockDataFor } from '#/test-utils/apolloMockProvider';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MyRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import {
  MyRecipeCard_RecipeFragmentDoc,
  type MyRecipeCard_RecipeFragment,
} from '#features/recipes/components/MyRecipeCard.generated';
import { useRecipeManagement } from '../useRecipeManagement';

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#/utils/finallyHelpers', () => ({
  executeMutation: jest.fn((fn: () => unknown) => fn()),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

type RecipeNode = NonNullable<
  NonNullable<
    NonNullable<MockDataFor<typeof MyRecipesDocument>['recipes']>['edges']
  >[number]['node']
>;

function buildRecipeNode(id: string, name: string): RecipeNode {
  return {
    __typename: 'Recipe',
    id,
    name,
    description: null,
    imageUrl: null,
    servings: 4,
    prepTimeMinutes: null,
    cookTimeMinutes: null,
    totalTimeMinutes: null,
  };
}

function recipesMock() {
  return recordMock(MyRecipesDocument, {
    data: {
      recipes: {
        __typename: 'RecipeConnection',
        edges: [
          {
            __typename: 'RecipeEdge',
            cursor: 'c1',
            node: buildRecipeNode('r1', 'Pasta'),
          },
          {
            __typename: 'RecipeEdge',
            cursor: 'c2',
            node: buildRecipeNode('r2', 'Salad'),
          },
          {
            __typename: 'RecipeEdge',
            cursor: 'c3',
            node: buildRecipeNode('r3', 'Soup'),
          },
        ],
        pageInfo: {
          __typename: 'PageInfo',
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: 3,
      },
    },
  });
}

// Page one ends at `page-1`; asking past it returns the last recipe.
function pagedRecipesMock() {
  return recordMock(MyRecipesDocument, {
    dataFor: (
      vars: Record<string, unknown>,
    ): MockDataFor<typeof MyRecipesDocument> => {
      const secondPage = vars.cursor === 'page-1';
      return {
        recipes: {
          __typename: 'RecipeConnection',
          edges: [
            {
              __typename: 'RecipeEdge',
              cursor: secondPage ? 'c2' : 'c1',
              node: secondPage
                ? buildRecipeNode('r2', 'Lasagne')
                : buildRecipeNode('r1', 'Pasta'),
            },
          ],
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage: !secondPage,
            endCursor: secondPage ? null : 'page-1',
          },
          totalCount: 2,
        },
      };
    },
  });
}

function useRecipeManagementWithClient() {
  const state = useRecipeManagement();
  const client = useApolloClient();
  return { ...state, client };
}

async function renderReady() {
  const { result } = renderHookWithApollo(
    () => useRecipeManagementWithClient(),
    {
      operationMocks: [recipesMock().mock],
    },
  );
  await waitFor(() => expect(result.current.state.recipes).toHaveLength(3));
  return result;
}

function readName(
  result: { current: ReturnType<typeof useRecipeManagementWithClient> },
  recipeId: string,
): string | undefined {
  const ref = result.current.state.recipes.find(r => r.id === recipeId);
  if (!ref) return undefined;
  return result.current.client.cache.readFragment<MyRecipeCard_RecipeFragment>({
    fragment: MyRecipeCard_RecipeFragmentDoc,
    fragmentName: 'MyRecipeCard_recipe',
    from: ref,
  })?.name;
}

describe('useRecipeManagement', () => {
  it('returns recipes from query data', async () => {
    const result = await renderReady();
    expect(readName(result, 'r1')).toBe('Pasta');
  });

  it('returns loading and error state', async () => {
    const result = await renderReady();
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeUndefined();
  });

  it('stops at the first page until the list asks for more', async () => {
    const { result } = renderHookWithApollo(() => useRecipeManagement(), {
      operationMocks: [pagedRecipesMock().mock],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(1));
    expect(result.current.state.hasMore).toBe(true);

    await act(async () => {
      await result.current.actions.loadMore();
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));
    expect(result.current.state.hasMore).toBe(false);
  });

  it('loadAllPages pages through the rest, so a search sees every recipe', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeManagement({ loadAllPages: true }),
      { operationMocks: [pagedRecipesMock().mock] },
    );

    await waitFor(() =>
      expect(result.current.state.recipes.map(r => r.name)).toEqual([
        'Pasta',
        'Lasagne',
      ]),
    );
    expect(result.current.state.isLoadingRemainingPages).toBe(false);
  });

  it('exposes refetch function', async () => {
    const result = await renderReady();
    expect(typeof result.current.actions.refetch).toBe('function');
  });
});
