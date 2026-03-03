'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { usePagination } from '../usePagination';

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

jest.mock('#/utils/compilerSafeWrappers');

describe('usePagination', () => {
  const mockFetchMore = jest.fn().mockResolvedValue({});

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hasMore reflects pageInfo.hasNextPage', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.hasMore).toBe(true);
  });

  it('hasMore is false when pageInfo.hasNextPage is false', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: false, endCursor: 'abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.hasMore).toBe(false);
  });

  it('endCursor reflects pageInfo.endCursor', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-123' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.endCursor).toBe('cursor-123');
  });

  it('loadMore() calls fetchMore with cursor and variables', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
        fetchMoreVariables: { id: 'list-1' },
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMore).toHaveBeenCalledWith({
      variables: {
        id: 'list-1',
        cursor: 'cursor-abc',
      },
    });
  });

  it('loadMore() uses custom cursorVariableName', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-xyz' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
        cursorVariableName: 'itemsCursor',
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMore).toHaveBeenCalledWith({
      variables: {
        itemsCursor: 'cursor-xyz',
      },
    });
  });

  it('loadMore() does nothing when hasMore is false', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: false, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMore).not.toHaveBeenCalled();
  });

  it('loadMore() does nothing when loading is true', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: true,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMore).not.toHaveBeenCalled();
  });

  it('loadMore() does nothing when endCursor is null', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: null },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchMore).not.toHaveBeenCalled();
  });

  it('isLoadingMore is true when loading and itemCount > 0', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        loading: true,
        itemCount: 5,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.isLoadingMore).toBe(true);
  });

  it('isLoadingMore is false when loading and itemCount is 0 (initial load)', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        loading: true,
        itemCount: 0,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.isLoadingMore).toBe(false);
  });
});
