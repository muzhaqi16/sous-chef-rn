import { useApolloClient } from '@apollo/client/react';
import type { MockFor, MockPart } from '#/test-utils/apolloMockProvider';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  MySavedRecipesDocument,
  type MySavedRecipesQuery,
} from '#features/recipes/screens/useSavedRecipes.generated';
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

/**
 * The node on the wire: what the query selects plus what the card's fragment
 * reads, since masking keeps a fragment's fields out of the query's own type
 * while the response still has to carry them.
 */
type SavedRecipeNode = NonNullable<
  MySavedRecipesQuery['me']
>['savedRecipesConnection']['edges'][number]['node'] &
  SavedRecipeCard_SavedRecipeFragment;

const buildRecipe = (
  id: string,
  name: string,
): MockPart<SavedRecipeNode['recipe']> => ({ id, name });

function buildSavedRecipeNode(
  id: string,
  recipe: ReturnType<typeof buildRecipe>,
  overrides: { folder?: string | null; tags?: string[] | null } = {},
): MockPart<SavedRecipeNode> {
  return {
    id,
    folder: overrides.folder ?? null,
    tags: overrides.tags ?? [],
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
): MockFor<typeof MySavedRecipesDocument> {
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
          id: 'user-1',
          savedRecipesConnection: {
            totalCount: options.totalCount ?? options.edges?.length ?? 0,
            edges:
              options.edges?.map(e => ({ cursor: e.cursor, node: e.node })) ??
              [],
            pageInfo: {
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
    }),
  },
  {
    cursor: 'c2',
    node: buildSavedRecipeNode('sr-2', buildRecipe('r-2', 'Salad'), {
      folder: null,
      tags: null,
    }),
  },
];

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

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
}): MockFor<typeof MySavedRecipesDocument> {
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
          id: 'user-1',
          savedRecipesConnection: {
            totalCount: 3,
            edges: options.edges.map(e => ({ cursor: e.cursor, node: e.node })),
            pageInfo: {
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

const searchByName = <T extends { recipe: { name: string } | null }>(
  recipes: readonly T[],
) => filterByTerm(recipes, 'lasagne', [saved => saved.recipe?.name]);

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
  )?.recipe?.name;
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

    await drainTimers();
    expect(result.current.state.recipes).toHaveLength(2);
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

    await drainTimers();
    expect(result.current.state.recipes).toHaveLength(2);
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

    await drainTimers();
    expect(result.current.state.recipes).toHaveLength(2);
    expect(result.current.state.hasMore).toBe(true);
  });

  describe('loadAllPages', () => {
    it('loads every remaining page, so a search finds a recipe on page 3', async () => {
      const { result } = renderHookWithApollo(
        () => useSavedRecipes({ loadAllPages: true }),
        { operationMocks: [firstPage, secondPage, thirdPage] },
      );

      await drainTimers();
      expect(result.current.state.recipes).toHaveLength(3);
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

      await drainTimers();
      expect(result.current.state.recipes).toHaveLength(1);
      expect(result.current.state.hasMore).toBe(true);
      expect(result.current.state.isLoadingRemainingPages).toBe(false);
      expect(searchByName(result.current.state.recipes)).toEqual([]);

      rerender({ loadAllPages: true });
      expect(result.current.state.isLoadingRemainingPages).toBe(true);

      await drainTimers();
      expect(result.current.state.recipes).toHaveLength(3);
      expect(searchByName(result.current.state.recipes)).toHaveLength(1);
    });

    it('stops on a failed page and keeps the rows already cached', async () => {
      // Read from every render: under load the failed page can settle before
      // `waitFor` polls again, so a snapshot can miss the running state.
      const loadingRemaining: boolean[] = [];
      const { result } = renderHookWithApollo(
        () => {
          const saved = useSavedRecipes({ loadAllPages: true });
          loadingRemaining.push(saved.state.isLoadingRemainingPages);
          return saved;
        },
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

      await drainTimers();
      expect(result.current.state.recipes).toHaveLength(1);
      await drainTimers();
      expect(result.current.state.isLoadingRemainingPages).toBe(false);
      expect(loadingRemaining).toContain(true);
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
