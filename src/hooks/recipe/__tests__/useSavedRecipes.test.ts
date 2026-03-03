import { renderHook } from '@testing-library/react-native';
import { useSavedRecipes } from '../useSavedRecipes';

const mockRefetch = jest.fn();
const mockFetchMore = jest.fn();

jest.mock('#generated', () => ({
  useMySavedRecipesQuery: jest.fn(() => ({
    data: {
      me: {
        savedRecipesConnection: {
          edges: [
            {
              node: {
                id: 'sr-1',
                recipe: {
                  id: 'r-1',
                  name: 'Pasta',
                  imageUrl: 'img.jpg',
                  servings: 4,
                  prepTimeMinutes: 10,
                  cookTimeMinutes: 20,
                  totalTimeMinutes: 30,
                  description: 'Good',
                  category: 'MAIN_COURSE',
                  difficulty: 'EASY',
                  cuisine: 'Italian',
                },
                folder: 'Weeknight',
                tags: ['Quick'],
                notes: 'my note',
                personalRating: 5,
                cookedCount: 3,
                lastCookedAt: '2025-01-01',
                createdAt: '2024-06-01',
                updatedAt: '2025-01-01',
              },
            },
            {
              node: {
                id: 'sr-2',
                recipe: {
                  id: 'r-2',
                  name: 'Salad',
                  imageUrl: null,
                  servings: 2,
                  prepTimeMinutes: null,
                  cookTimeMinutes: null,
                  totalTimeMinutes: null,
                  description: null,
                  category: null,
                  difficulty: null,
                  cuisine: null,
                },
                folder: null,
                tags: null,
                notes: null,
                personalRating: null,
                cookedCount: null,
                lastCookedAt: null,
                createdAt: '2024-05-01',
                updatedAt: '2024-05-01',
              },
            },
          ],
          pageInfo: { hasNextPage: true, endCursor: 'cursor-2' },
          totalCount: 10,
        },
      },
    },
    loading: false,
    error: undefined,
    refetch: mockRefetch,
    fetchMore: mockFetchMore,
  })),
}));

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({ isLoggedOut: false })),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

// Break circular dependency
jest.mock('../../../apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useSavedRecipes', () => {
  it('normalizes saved recipes correctly', () => {
    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.recipes).toHaveLength(2);
    expect(result.current.recipes[0]).toEqual(
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

    expect(result.current.recipes[1].tags).toEqual([]);
    expect(result.current.recipes[1].cookedCount).toBe(0);
  });

  it('returns totalCount and hasNextPage', () => {
    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.totalCount).toBe(10);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('getRecipeById finds by recipeId', () => {
    const { result } = renderHook(() => useSavedRecipes());

    const found = result.current.getRecipeById('r-1');
    expect(found?.name).toBe('Pasta');
  });

  it('getRecipesByFolder filters by folder', () => {
    const { result } = renderHook(() => useSavedRecipes());

    const weeknight = result.current.getRecipesByFolder('Weeknight');
    expect(weeknight).toHaveLength(1);
    expect(weeknight[0].name).toBe('Pasta');
  });

  it('getRecipesByTag filters by tag', () => {
    const { result } = renderHook(() => useSavedRecipes());

    const quick = result.current.getRecipesByTag('Quick');
    expect(quick).toHaveLength(1);
    expect(quick[0].name).toBe('Pasta');
  });

  it('returns empty recipes when data is undefined', () => {
    const { useMySavedRecipesQuery } = require('#generated');
    useMySavedRecipesQuery.mockReturnValueOnce({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: mockRefetch,
      fetchMore: mockFetchMore,
    });

    const { result } = renderHook(() => useSavedRecipes());

    expect(result.current.recipes).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
});
