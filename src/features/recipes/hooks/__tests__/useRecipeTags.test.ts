import { renderHook } from '@testing-library/react-native';
import { useRecipeTags } from '../useRecipeTags';

const mockRefetch = jest.fn();

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
                { node: { tags: ['Italian', 'Quick'] } },
                { node: { tags: ['italian', 'Quick'] } },
                { node: { tags: ['Vegetarian'] } },
              ],
            },
          },
        },
        loading: false,
        error: undefined,
        refetch: mockRefetch,
      };
    }
    return { data: undefined, loading: false, error: undefined };
  }),
}));

// Break circular dependency
jest.mock('#/apollo/links/tokenScheduler');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useRecipeTags', () => {
  it('extracts unique tags sorted case-insensitively', () => {
    const { result } = renderHook(() => useRecipeTags());

    // 'Italian', 'italian' are different strings so both appear
    // Sort is case-insensitive
    expect(result.current.tags).toEqual([
      'Italian',
      'italian',
      'Quick',
      'Vegetarian',
    ]);
  });

  it('computes tag counts', () => {
    const { result } = renderHook(() => useRecipeTags());

    expect(result.current.tagCounts).toEqual({
      Italian: 1,
      Quick: 2,
      Vegetarian: 1,
      italian: 1,
    });
  });

  it('returns empty tags when no saved recipes', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: undefined,
      loading: false,
      error: undefined,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useRecipeTags());

    expect(result.current.tags).toEqual([]);
    expect(result.current.tagCounts).toEqual({});
  });

  it('exposes loading and refetch', () => {
    const { result } = renderHook(() => useRecipeTags());

    expect(result.current.loading).toBe(false);
    expect(result.current.refetch).toBe(mockRefetch);
  });
});
