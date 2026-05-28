import { waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { MySavedRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import {
  SavedRecipeCard_SavedRecipeFragmentDoc,
  type SavedRecipeCard_SavedRecipeFragment,
} from '#features/recipes/components/SavedRecipeCard.generated';
import {
  Difficulty,
  RecipeCategory,
  RecipeStatus,
} from '#/graphql/generated/schemaTypes';
import { useSavedRecipes } from '../useSavedRecipes';

jest.mock('#hooks/auth/useIsLoggedOut', () => ({
  useIsLoggedOut: jest.fn(() => false),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

function buildRecipe(
  id: string,
  name: string,
  overrides: Record<string, unknown> = {},
) {
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
    difficulty: Difficulty.Easy,
    category: RecipeCategory.MainCourse,
    cuisine: null,
    status: RecipeStatus.Published,
    isExternal: false,
    externalSource: null,
    externalId: null,
    primarySource: null,
    caloriesPerServing: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    savedDetails: null,
    ...overrides,
  };
}

function buildSavedRecipeNode(
  id: string,
  recipe: ReturnType<typeof buildRecipe>,
  overrides: {
    folder?: string | null;
    tags?: string[] | null;
    cookedCount?: number | null;
  } = {},
) {
  return {
    __typename: 'SavedRecipe',
    id,
    folder: overrides.folder ?? null,
    tags: overrides.tags ?? [],
    notes: null,
    personalRating: null,
    cookedCount: overrides.cookedCount ?? 0,
    lastCookedAt: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    recipe,
  };
}

function buildMySavedRecipesMock(
  options: {
    edges?: Array<{
      cursor: string;
      node: ReturnType<typeof buildSavedRecipeNode>;
    }>;
    totalCount?: number;
    hasNextPage?: boolean;
    error?: Error;
  } = {},
): MockedResponse {
  if (options.error) {
    return {
      request: {
        query: MySavedRecipesDocument,
        variables: { folder: undefined, first: 20 },
      },
      error: options.error,
    };
  }

  return {
    request: {
      query: MySavedRecipesDocument,
      variables: { folder: undefined, first: 20 },
    },
    result: {
      data: {
        me: {
          __typename: 'User',
          id: 'user-1',
          savedRecipesConnection: {
            __typename: 'SavedRecipeConnection',
            totalCount: options.totalCount ?? options.edges?.length ?? 0,
            edges:
              options.edges?.map(e => ({
                __typename: 'SavedRecipeEdge',
                cursor: e.cursor,
                node: e.node,
              })) ?? [],
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: options.hasNextPage ?? false,
              endCursor: options.hasNextPage ? 'cursor' : null,
            },
          },
        },
      },
    },
  };
}

const standardEdges = [
  {
    cursor: 'c1',
    node: buildSavedRecipeNode('sr-1', buildRecipe('r-1', 'Pasta'), {
      folder: 'Weeknight',
      tags: ['Quick'],
      cookedCount: 3,
    }),
  },
  {
    cursor: 'c2',
    node: buildSavedRecipeNode('sr-2', buildRecipe('r-2', 'Salad'), {
      folder: null,
      tags: null,
      cookedCount: null,
    }),
  },
];

beforeEach(() => {
  jest.clearAllMocks();
});

function useSavedRecipesWithClient(folder?: string | null) {
  const state = useSavedRecipes(folder);
  const client = useApolloClient();
  return { ...state, client };
}

function readName(
  result: { current: ReturnType<typeof useSavedRecipesWithClient> },
  savedRecipeId: string,
): string | undefined {
  const ref = result.current.state.recipes.find(r => r.id === savedRecipeId);
  if (!ref) return undefined;
  return result.current.client.cache.readFragment<SavedRecipeCard_SavedRecipeFragment>(
    {
      fragment: SavedRecipeCard_SavedRecipeFragmentDoc,
      fragmentName: 'SavedRecipeCard_savedRecipe',
      from: ref,
    },
  )?.recipe.name;
}

describe('useSavedRecipes', () => {
  it('returns saved recipe nodes (rendering reads the recipe via useFragment)', async () => {
    const { result } = renderHookWithApollo(() => useSavedRecipesWithClient(), {
      operationMocks: [
        buildMySavedRecipesMock({
          edges: standardEdges,
          totalCount: 10,
          hasNextPage: true,
        }),
      ],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));
    expect(result.current.state.recipes[0].id).toBe('sr-1');
    expect(result.current.state.recipes[0].folder).toBe('Weeknight');
    expect(result.current.state.recipes[0].tags).toEqual(['Quick']);
    expect(readName(result, 'sr-1')).toBe('Pasta');
  });

  it('passes through null tags', async () => {
    const { result } = renderHookWithApollo(() => useSavedRecipesWithClient(), {
      operationMocks: [
        buildMySavedRecipesMock({
          edges: standardEdges,
          totalCount: 10,
          hasNextPage: true,
        }),
      ],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));
    expect(result.current.state.recipes[1].tags).toEqual([]);
  });

  it('returns totalCount and hasNextPage', async () => {
    const { result } = renderHookWithApollo(() => useSavedRecipesWithClient(), {
      operationMocks: [
        buildMySavedRecipesMock({
          edges: standardEdges,
          totalCount: 10,
          hasNextPage: true,
        }),
      ],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));
    expect(result.current.state.totalCount).toBe(10);
    expect(result.current.state.hasMore).toBe(true);
  });

  it('getRecipeById finds by recipeId', async () => {
    const { result } = renderHookWithApollo(() => useSavedRecipesWithClient(), {
      operationMocks: [
        buildMySavedRecipesMock({ edges: standardEdges, totalCount: 10 }),
      ],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));

    const found = result.current.actions.getRecipeById('r-1');
    expect(found?.id).toBe('sr-1');
    expect(readName(result, found!.id)).toBe('Pasta');
  });

  it('getRecipesByFolder filters by folder', async () => {
    const { result } = renderHookWithApollo(() => useSavedRecipesWithClient(), {
      operationMocks: [
        buildMySavedRecipesMock({ edges: standardEdges, totalCount: 10 }),
      ],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));

    const weeknight = result.current.actions.getRecipesByFolder('Weeknight');
    expect(weeknight).toHaveLength(1);
    expect(readName(result, weeknight[0].id)).toBe('Pasta');
  });

  it('getRecipesByTag filters by tag', async () => {
    const { result } = renderHookWithApollo(() => useSavedRecipesWithClient(), {
      operationMocks: [
        buildMySavedRecipesMock({ edges: standardEdges, totalCount: 10 }),
      ],
    });

    await waitFor(() => expect(result.current.state.recipes).toHaveLength(2));

    const quick = result.current.actions.getRecipesByTag('Quick');
    expect(quick).toHaveLength(1);
    expect(readName(result, quick[0].id)).toBe('Pasta');
  });

  it('returns empty recipes when data is undefined (skipped via logged-out flag)', () => {
    const { useIsLoggedOut } = require('#hooks/auth/useIsLoggedOut');
    useIsLoggedOut.mockReturnValueOnce(true);

    // No mock provided — query is skipped because user is logged out
    const { result } = renderHookWithApollo(() => useSavedRecipes());

    expect(result.current.state.recipes).toEqual([]);
    expect(result.current.state.loading).toBe(false);
  });
});
