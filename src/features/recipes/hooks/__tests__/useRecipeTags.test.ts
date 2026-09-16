import { waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { MySavedRecipesDocument } from '#features/recipes/graphql/recipe.generated';
import { useRecipeTags } from '../useRecipeTags';

jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

function withSavedRecipes(recipeTags: string[][]) {
  return recordMock(MySavedRecipesDocument, {
    data: {
      me: {
        id: 'user-1',
        savedRecipesConnection: {
          edges: recipeTags.map((tags, idx) => ({
            cursor: `c-${idx}`,
            node: { id: `sr-${idx}`, tags },
          })),
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    },
  });
}

describe('useRecipeTags', () => {
  it('extracts unique tags sorted case-insensitively', async () => {
    const server = withSavedRecipes([
      ['Italian', 'Quick'],
      ['italian', 'Quick'],
      ['Vegetarian'],
    ]);
    const { result } = renderHookWithApollo(() => useRecipeTags(), {
      operationMocks: [server.mock],
    });

    await waitFor(() => expect(result.current.tags.length).toBeGreaterThan(0));
    expect(result.current.tags).toEqual([
      'Italian',
      'italian',
      'Quick',
      'Vegetarian',
    ]);
  });

  it('returns empty tags when no saved recipes', async () => {
    const server = withSavedRecipes([]);
    const { result } = renderHookWithApollo(() => useRecipeTags(), {
      operationMocks: [server.mock],
    });

    await waitFor(() => expect(server.fired).toHaveLength(1));
    expect(result.current.tags).toEqual([]);
  });
});
