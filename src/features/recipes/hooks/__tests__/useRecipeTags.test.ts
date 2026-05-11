import { waitFor } from '@testing-library/react-native';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useRecipeTags } from '../useRecipeTags';

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function withSavedRecipes(recipeTags: string[][]) {
  return {
    mocks: {
      Query: () => ({
        me: {
          __typename: 'User',
          savedRecipesConnection: {
            __typename: 'RecipeConnection',
            edges: recipeTags.map((tags, idx) => ({
              __typename: 'RecipeEdge',
              node: { __typename: 'Recipe', id: `r-${idx}`, tags },
            })),
          },
        },
      }),
    },
  };
}

describe('useRecipeTags', () => {
  it('extracts unique tags sorted case-insensitively', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeTags(),
      withSavedRecipes([
        ['Italian', 'Quick'],
        ['italian', 'Quick'],
        ['Vegetarian'],
      ]),
    );

    await waitFor(() => expect(result.current.tags.length).toBeGreaterThan(0));
    expect(result.current.tags).toEqual([
      'Italian',
      'italian',
      'Quick',
      'Vegetarian',
    ]);
  });

  it('computes tag counts', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeTags(),
      withSavedRecipes([
        ['Italian', 'Quick'],
        ['italian', 'Quick'],
        ['Vegetarian'],
      ]),
    );

    await waitFor(() => expect(result.current.tags.length).toBeGreaterThan(0));
    expect(result.current.tagCounts).toEqual({
      Italian: 1,
      Quick: 2,
      Vegetarian: 1,
      italian: 1,
    });
  });

  it('returns empty tags when no saved recipes', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeTags(),
      withSavedRecipes([]),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tags).toEqual([]);
    expect(result.current.tagCounts).toEqual({});
  });

  it('exposes loading and refetch', async () => {
    const { result } = renderHookWithApollo(
      () => useRecipeTags(),
      withSavedRecipes([]),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(typeof result.current.refetch).toBe('function');
  });
});
