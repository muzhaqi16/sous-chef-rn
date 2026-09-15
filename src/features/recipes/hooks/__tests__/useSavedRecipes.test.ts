import { waitFor } from '@testing-library/react-native';
import { useApolloClient } from '@apollo/client/react';
import type { MockedResponse } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { MySavedRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import {
  SavedRecipeCard_SavedRecipeFragmentDoc,
  type SavedRecipeCard_SavedRecipeFragment,
} from '#features/recipes/components/SavedRecipeCard.generated';
import { filterByTerm } from '#hooks/search/useLocalSearch';
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
  // Exactly what `MySavedRecipes` selects on the nested recipe: `id`, `name`
  // and `description` at the parent, plus the four card fields from
  // `SavedRecipeCard_savedRecipe`. The recipe's own category, status, external
  // provenance and timestamps are not on this query's wire at all.
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
        variables: { first: 20 },
      },
      error: options.error,
    };
  }

  return {
    request: {
      query: MySavedRecipesDocument,
      variables: { first: 20 },
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

function buildPageMock(options: {
  after?: string;
  edges: Array<{
    cursor: string;
    node: ReturnType<typeof buildSavedRecipeNode>;
  }>;
  endCursor: string | null;
  error?: Error;
}): MockedResponse {
  const request = {
    query: MySavedRecipesDocument,
    variables: {
      first: 20,
      ...(options.after ? { after: options.after } : {}),
    },
  };
  if (options.error) return { request, error: options.error };
  return {
    request,
    result: {
      data: {
        me: {
          __typename: 'User',
          id: 'user-1',
          savedRecipesConnection: {
            __typename: 'SavedRecipeConnection',
            totalCount: 3,
            edges: options.edges.map(e => ({
              __typename: 'SavedRecipeEdge',
              cursor: e.cursor,
              node: e.node,
            })),
            pageInfo: {
              __typename: 'PageInfo',
              hasNextPage: options.endCursor !== null,
              endCursor: options.endCursor,
            },
          },
        },
      },
    },
  };
}

const firstPage = buildPageMock({
  edges: [standardEdges[0]!],
  endCursor: 'page-1',
});
const secondPage = buildPageMock({
  after: 'page-1',
  edges: [standardEdges[1]!],
  endCursor: 'page-2',
});
const thirdPage = buildPageMock({
  after: 'page-2',
  edges: [
    {
      cursor: 'c3',
      node: buildSavedRecipeNode('sr-3', buildRecipe('r-3', 'Lasagne')),
    },
  ],
  endCursor: null,
});

const searchByName = <T extends { recipe: { name: string } }>(
  recipes: readonly T[],
) => filterByTerm(recipes, 'lasagne', [saved => saved.recipe.name]);

function useSavedRecipesWithClient() {
  const state = useSavedRecipes();
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
    expect(result.current.state.recipes[0]!.id).toBe('sr-1');
    expect(result.current.state.recipes[0]!.folder).toBe('Weeknight');
    expect(result.current.state.recipes[0]!.tags).toEqual(['Quick']);
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
    expect(result.current.state.recipes[1]!.tags).toEqual([]);
  });

  it('returns hasNextPage as hasMore', async () => {
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
    expect(result.current.state.hasMore).toBe(true);
  });

  describe('loadAllPages', () => {
    it('loads every remaining page, so a search finds a recipe on page 3', async () => {
      const { result } = renderHookWithApollo(
        () => useSavedRecipes({ loadAllPages: true }),
        { operationMocks: [firstPage, secondPage, thirdPage] },
      );

      await waitFor(() => expect(result.current.state.recipes).toHaveLength(3));
      expect(searchByName(result.current.state.recipes).map(r => r.id)).toEqual(
        ['sr-3'],
      );
      expect(result.current.state.hasMore).toBe(false);
      expect(result.current.state.isLoadingRemainingPages).toBe(false);
    });

    it('loads nothing past page one until it is switched on', async () => {
      const { result, rerender } = renderHookWithApollo(
        ({ loadAllPages }: { loadAllPages: boolean }) =>
          useSavedRecipes({ loadAllPages }),
        {
          operationMocks: [firstPage, secondPage, thirdPage],
          initialProps: { loadAllPages: false },
        },
      );

      await waitFor(() => expect(result.current.state.recipes).toHaveLength(1));
      expect(result.current.state.hasMore).toBe(true);
      expect(result.current.state.isLoadingRemainingPages).toBe(false);
      expect(searchByName(result.current.state.recipes)).toEqual([]);

      rerender({ loadAllPages: true });
      expect(result.current.state.isLoadingRemainingPages).toBe(true);

      await waitFor(() => expect(result.current.state.recipes).toHaveLength(3));
      expect(searchByName(result.current.state.recipes)).toHaveLength(1);
    });

    it('stops on a failed page and keeps the rows already cached', async () => {
      const { result } = renderHookWithApollo(
        () => useSavedRecipes({ loadAllPages: true }),
        {
          operationMocks: [
            firstPage,
            buildPageMock({
              after: 'page-1',
              edges: [],
              endCursor: null,
              error: new Error('Network request failed'),
            }),
          ],
        },
      );

      await waitFor(() => expect(result.current.state.recipes).toHaveLength(1));
      expect(result.current.state.isLoadingRemainingPages).toBe(true);
      await waitFor(() =>
        expect(result.current.state.isLoadingRemainingPages).toBe(false),
      );
      expect(result.current.state.hasMore).toBe(true);
      expect(result.current.state.recipes.map(r => r.id)).toEqual(['sr-1']);
    });
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
