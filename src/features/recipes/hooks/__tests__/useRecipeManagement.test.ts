import { renderHook } from '@testing-library/react-native';
import { useRecipeManagement } from '../useRecipeManagement';

const mockRefetch = jest.fn();
const mockFetchMore = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useMyRecipesQuery: jest.fn(() => ({
    data: {
      recipes: {
        edges: [
          {
            node: {
              id: 'r1',
              name: 'Pasta',
              category: 'MAIN_COURSE',
              difficulty: 'EASY',
            },
          },
          {
            node: {
              id: 'r2',
              name: 'Salad',
              category: 'APPETIZER',
              difficulty: 'EASY',
            },
          },
          {
            node: {
              id: 'r3',
              name: 'Cake',
              category: 'DESSERT',
              difficulty: 'HARD',
            },
          },
        ],
        totalCount: 3,
        pageInfo: { hasNextPage: false, endCursor: 'c3' },
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

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeMutation: jest.fn((fn: any) => fn()),
}));

jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRecipeManagement', () => {
  it('returns recipes from query data', () => {
    const { result } = renderHook(() => useRecipeManagement());

    expect(result.current.state.recipes).toHaveLength(3);
    expect(result.current.state.recipes[0].name).toBe('Pasta');
    expect(result.current.state.totalCount).toBe(3);
  });

  it('returns loading and error state', () => {
    const { result } = renderHook(() => useRecipeManagement());

    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeUndefined();
  });

  it('getRecipeById finds a recipe by ID', () => {
    const { result } = renderHook(() => useRecipeManagement());

    const recipe = result.current.actions.getRecipeById('r2');
    expect(recipe?.name).toBe('Salad');
  });

  it('getRecipeById returns undefined for unknown ID', () => {
    const { result } = renderHook(() => useRecipeManagement());

    expect(result.current.actions.getRecipeById('unknown')).toBeUndefined();
  });

  it('getRecipesByCategory filters by category', () => {
    const { result } = renderHook(() => useRecipeManagement());

    const mainCourses = result.current.actions.getRecipesByCategory(
      'MAIN_COURSE' as any,
    );
    expect(mainCourses).toHaveLength(1);
    expect(mainCourses[0].name).toBe('Pasta');
  });

  it('getRecipesByDifficulty filters by difficulty', () => {
    const { result } = renderHook(() => useRecipeManagement());

    const easy = result.current.actions.getRecipesByDifficulty('EASY' as any);
    expect(easy).toHaveLength(2);
  });

  it('exposes refetch', () => {
    const { result } = renderHook(() => useRecipeManagement());

    expect(result.current.actions.refetch).toBe(mockRefetch);
  });
});
