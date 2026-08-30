import { waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
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
import { Difficulty, RecipeCategory } from '#/graphql/generated/schemaTypes';

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

function buildRecipeNode(
  id: string,
  name: string,
  category: RecipeCategory,
  difficulty: Difficulty,
) {
  return {
    __typename: 'Recipe' as const,
    id,
    name,
    category,
    difficulty,
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
        __typename: 'RecipeConnection' as const,
        edges: [
          {
            __typename: 'RecipeEdge' as const,
            cursor: 'c1',
            node: buildRecipeNode(
              'r1',
              'Pasta',
              RecipeCategory.MainCourse,
              Difficulty.Easy,
            ),
          },
          {
            __typename: 'RecipeEdge' as const,
            cursor: 'c2',
            node: buildRecipeNode(
              'r2',
              'Salad',
              RecipeCategory.Appetizer,
              Difficulty.Easy,
            ),
          },
          {
            __typename: 'RecipeEdge' as const,
            cursor: 'c3',
            node: buildRecipeNode(
              'r3',
              'Soup',
              RecipeCategory.Appetizer,
              Difficulty.Hard,
            ),
          },
        ],
        pageInfo: {
          __typename: 'PageInfo' as const,
          hasNextPage: false,
          endCursor: null,
        },
        totalCount: 3,
      },
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
    expect(result.current.state.totalCount).toBe(3);
  });

  it('returns loading and error state', async () => {
    const result = await renderReady();
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeUndefined();
  });

  it('getRecipeById finds a recipe by ID', async () => {
    const result = await renderReady();
    const recipe = result.current.actions.getRecipeById('r2');
    expect(recipe?.id).toBe('r2');
    expect(readName(result, 'r2')).toBe('Salad');
  });

  it('getRecipeById returns undefined for unknown ID', async () => {
    const result = await renderReady();
    expect(result.current.actions.getRecipeById('unknown')).toBeUndefined();
  });

  it('getRecipesByCategory filters by category', async () => {
    const result = await renderReady();
    const mainCourses = result.current.actions.getRecipesByCategory(
      RecipeCategory.MainCourse,
    );
    expect(mainCourses).toHaveLength(1);
    expect(readName(result, mainCourses[0].id)).toBe('Pasta');
  });

  it('getRecipesByDifficulty filters by difficulty', async () => {
    const result = await renderReady();
    const easy = result.current.actions.getRecipesByDifficulty(Difficulty.Easy);
    expect(easy).toHaveLength(2);
  });

  it('exposes refetch function', async () => {
    const result = await renderReady();
    expect(typeof result.current.actions.refetch).toBe('function');
  });
});
