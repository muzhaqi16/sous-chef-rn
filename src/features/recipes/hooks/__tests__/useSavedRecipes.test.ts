import { renderHook } from '@testing-library/react-native';
import { useSavedRecipes } from '../useSavedRecipes';

const mockRefetch = jest.fn();
const mockFetchMore = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'MySavedRecipes') {
      return {
        data: {
          me: {
            savedRecipesConnection: {
              edges: [
                {
                  node: {
                    id: 'sr-1',
                    folder: 'Weeknight',
                    tags: ['Quick'],
                    cookedCount: 3,
                    createdAt: '2024-01-01',
                    updatedAt: '2024-01-01',
                    recipe: { id: 'r-1', name: 'Pasta' },
                  },
                },
                {
                  node: {
                    id: 'sr-2',
                    folder: null,
                    tags: null,
                    cookedCount: null,
                    createdAt: '2024-01-01',
                    updatedAt: '2024-01-01',
                    recipe: { id: 'r-2', name: 'Salad' },
                  },
                },
              ],
              pageInfo: { hasNextPage: true, endCursor: 'cursor' },
              totalCount: 10,
            },
          },
        },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
        fetchMore: mockFetchMore,
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({ isLoggedOut: false })),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSavedRecipes', () => {
  it('normalizes saved recipes correctly', () => {
    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.state.recipes).toHaveLength(2);
    expect(result.current.state.recipes[0]).toEqual(
      expect.objectContaining({
        id: 'sr-1',
        recipeId: 'r-1',
        name: 'Pasta',
        folder: 'Weeknight',
        tags: ['Quick'],
        cookedCount: 3,
      }),
    );
  });

  it('handles null tags and cookedCount', () => {
    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.state.recipes[1].tags).toEqual([]);
    expect(result.current.state.recipes[1].cookedCount).toBe(0);
  });

  it('returns totalCount and hasNextPage', () => {
    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.state.totalCount).toBe(10);
    expect(result.current.state.hasMore).toBe(true);
  });

  it('getRecipeById finds by recipeId', () => {
    const { result } = renderHook(() => useSavedRecipes());

    const found = result.current.actions.getRecipeById('r-1');
    expect(found?.name).toBe('Pasta');
  });

  it('getRecipesByFolder filters by folder', () => {
    const { result } = renderHook(() => useSavedRecipes());

    const weeknight = result.current.actions.getRecipesByFolder('Weeknight');
    expect(weeknight).toHaveLength(1);
    expect(weeknight[0].name).toBe('Pasta');
  });

  it('getRecipesByTag filters by tag', () => {
    const { result } = renderHook(() => useSavedRecipes());

    const quick = result.current.actions.getRecipesByTag('Quick');
    expect(quick).toHaveLength(1);
    expect(quick[0].name).toBe('Pasta');
  });

  it('returns empty recipes when data is undefined', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: mockRefetch,
      fetchMore: mockFetchMore,
    });

    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.state.recipes).toEqual([]);
    expect(result.current.state.loading).toBe(true);
  });
});
