import { renderHook } from '@testing-library/react-native';
import { useRecipeFolders } from '../useRecipeFolders';

const mockRefetch = jest.fn();

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useQuery: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'SavedRecipeFolders') {
      return {
        data: { savedRecipeFolders: ['Weeknight', 'Holiday', 'Quick'] },
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

describe('useRecipeFolders', () => {
  it('returns folder names from query', () => {
    const { result } = renderHook(() => useRecipeFolders());

    expect(result.current.folders).toEqual(['Weeknight', 'Holiday', 'Quick']);
  });

  it('returns empty array when data is undefined', () => {
    const { useQuery } = require('@apollo/client/react');
    (useQuery as jest.Mock).mockReturnValueOnce({
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
    const { useQuery } = require('@apollo/client/react');
    const mockError = new Error('Network error');
    (useQuery as jest.Mock).mockReturnValueOnce({
      data: undefined,
      loading: false,
      error: mockError,
      refetch: mockRefetch,
    });

    const { result } = renderHook(() => useRecipeFolders());

    expect(result.current.error).toBe(mockError);
  });
});
