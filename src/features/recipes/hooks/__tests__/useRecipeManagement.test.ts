import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MyRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeManagement } from '../useRecipeManagement';

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: () => false,
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutation: jest.fn((fn: any) => fn()),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function recipesMock() {
  return recordMock(MyRecipesDocument, {
    data: {
      recipes: {
        __typename: 'RecipeConnection',
        edges: [
          {
            __typename: 'RecipeEdge',
            cursor: 'c1',
            node: {
              __typename: 'Recipe',
              id: 'r1',
              name: 'Pasta',
              category: 'MAIN_COURSE',
              difficulty: 'EASY',
            },
          },
          {
            __typename: 'RecipeEdge',
            cursor: 'c2',
            node: {
              __typename: 'Recipe',
              id: 'r2',
              name: 'Salad',
              category: 'APPETIZER',
              difficulty: 'EASY',
            },
          },
          {
            __typename: 'RecipeEdge',
            cursor: 'c3',
            node: {
              __typename: 'Recipe',
              id: 'r3',
              name: 'Soup',
              category: 'APPETIZER',
              difficulty: 'HARD',
            },
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

async function renderReady() {
  const { result } = renderHookWithApollo(() => useRecipeManagement(), {
    operationMocks: [recipesMock().mock],
  });
  await waitFor(() => expect(result.current.state.recipes).toHaveLength(3));
  return result;
}

describe('useRecipeManagement', () => {
  it('returns recipes from query data', async () => {
    const result = await renderReady();
    expect(result.current.state.recipes[0].name).toBe('Pasta');
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
    expect(recipe?.name).toBe('Salad');
  });

  it('getRecipeById returns undefined for unknown ID', async () => {
    const result = await renderReady();
    expect(result.current.actions.getRecipeById('unknown')).toBeUndefined();
  });

  it('getRecipesByCategory filters by category', async () => {
    const result = await renderReady();
    const mainCourses = result.current.actions.getRecipesByCategory(
      'MAIN_COURSE' as any,
    );
    expect(mainCourses).toHaveLength(1);
    expect(mainCourses[0].name).toBe('Pasta');
  });

  it('getRecipesByDifficulty filters by difficulty', async () => {
    const result = await renderReady();
    const easy = result.current.actions.getRecipesByDifficulty('EASY' as any);
    expect(easy).toHaveLength(2);
  });

  it('exposes refetch function', async () => {
    const result = await renderReady();
    expect(typeof result.current.actions.refetch).toBe('function');
  });
});
