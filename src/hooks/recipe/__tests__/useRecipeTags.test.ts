import { renderHook } from '@testing-library/react-native';
import { useRecipeTags } from '../useRecipeTags';

const mockRefetch = jest.fn();

jest.mock('#generated', () => ({
  useMySavedRecipesQuery: jest.fn(() => ({
    data: {
      me: {
        savedRecipesConnection: {
          edges: [
            { node: { tags: ['Italian', 'Quick'] } },
            { node: { tags: ['Quick', 'Vegetarian'] } },
            { node: { tags: null } },
            { node: { tags: [] } },
            { node: { tags: ['italian'] } }, // lowercase duplicate
          ],
        },
      },
    },
    loading: false,
    error: undefined,
    refetch: mockRefetch,
  })),
}));

// Break circular dependency
jest.mock('../../../apollo/links/tokenScheduler', () => ({}));

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
    const { useMySavedRecipesQuery } = require('#generated');
    useMySavedRecipesQuery.mockReturnValueOnce({
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
