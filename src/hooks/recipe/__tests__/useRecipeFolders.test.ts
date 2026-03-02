import { renderHook } from '@testing-library/react-native';
import { useRecipeFolders } from '../useRecipeFolders';

const mockRefetch = jest.fn();

jest.mock('#generated', () => ({
  useSavedRecipeFoldersQuery: jest.fn(() => ({
    data: { savedRecipeFolders: ['Weeknight', 'Holiday', 'Quick'] },
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

describe('useRecipeFolders', () => {
  it('returns folder names from query', () => {
    const { result } = renderHook(() => useRecipeFolders());

    expect(result.current.folders).toEqual(['Weeknight', 'Holiday', 'Quick']);
  });

  it('returns empty array when data is undefined', () => {
    const { useSavedRecipeFoldersQuery } = require('#generated');
    useSavedRecipeFoldersQuery.mockReturnValueOnce({
      data: undefined,
      loading: true,
      error: undefined,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useRecipeFolders());

    expect(result.current.folders).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('exposes refetch function', () => {
    const { result } = renderHook(() => useRecipeFolders());

    expect(result.current.refetch).toBe(mockRefetch);
  });

  it('returns error when query fails', () => {
    const { useSavedRecipeFoldersQuery } = require('#generated');
    const mockError = new Error('Network error');
    useSavedRecipeFoldersQuery.mockReturnValueOnce({
      data: undefined,
      loading: false,
      error: mockError,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useRecipeFolders());

    expect(result.current.error).toBe(mockError);
  });
});
