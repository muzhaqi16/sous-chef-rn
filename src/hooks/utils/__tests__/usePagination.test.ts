'use no memo';

import { renderHook, act } from '@testing-library/react-native';
import { executeMutation } from '#/utils/compilerSafeWrappers';
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

  it('isLoadingMore is false during initial load even with cached items', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        loading: true,
        itemCount: 5,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.isLoadingMore).toBe(false);
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

  it('isLoadingMore is true during fetchMore and false after', async () => {
    let resolveFetch!: () => void;
    jest.mocked(executeMutation).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    expect(result.current.isLoadingMore).toBe(false);

    let loadMorePromise: Promise<void>;
    act(() => {
      loadMorePromise = result.current.loadMore();
    });

    expect(result.current.isLoadingMore).toBe(true);

    await act(async () => {
      resolveFetch();
      await loadMorePromise!;
    });

    expect(result.current.isLoadingMore).toBe(false);
  });

  it('loadMore() does nothing when already fetching more', async () => {
    let resolveFetch!: () => void;
    jest.mocked(executeMutation).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    let loadMorePromise: Promise<void>;
    act(() => {
      loadMorePromise = result.current.loadMore();
    });

    // Second call while first is in progress should be ignored
    await act(async () => {
      await result.current.loadMore();
    });

    expect(executeMutation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch();
      await loadMorePromise!;
    });
  });

  it('ref guard stays active until re-render prevents stale-closure loadMore', async () => {
    // Simulates: fetchMore resolves → isFetchingMore=false scheduled → before
    // re-render, onEndReached fires again with stale hasMore=true/endCursor.
    // The ref should still be true until the useEffect clears it post-render.
    let resolveFetch!: () => void;
    jest.mocked(executeMutation).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveFetch = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      (props: { hasMore: boolean; endCursor: string }) =>
        usePagination({
          pageInfo: { hasNextPage: props.hasMore, endCursor: props.endCursor },
          loading: false,
          itemCount: 10,
          fetchMore: mockFetchMore,
        }),
      { initialProps: { hasMore: true, endCursor: 'cursor-60' } },
    );

    // Start first loadMore
    let loadMorePromise: Promise<void>;
    act(() => {
      loadMorePromise = result.current.loadMore();
    });
    expect(executeMutation).toHaveBeenCalledTimes(1);

    // fetchMore resolves — but DON'T let React re-render yet
    await act(async () => {
      resolveFetch();
      await loadMorePromise!;
    });

    // Re-render with updated props (hasMore=false) — simulates Apollo cache update
    rerender({ hasMore: false, endCursor: 'cursor-79' });

    // Now try to loadMore again — should be blocked because hasMore is false
    await act(async () => {
      await result.current.loadMore();
    });

    // Should still only have been called once
    expect(executeMutation).toHaveBeenCalledTimes(1);
  });

  it('concurrent loadMore calls: ref guard prevents duplicate fetches even before state updates', async () => {
    // executeMutation returns a slow promise so both calls overlap
    let resolveFetch!: () => void;
    jest.mocked(executeMutation).mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        fetchMore: mockFetchMore,
      }),
    );

    // Fire two loadMore calls synchronously in the same act() — simulates
    // two rapid onEndReached events before React can batch state updates
    let promise1: Promise<void>;
    let promise2: Promise<void>;
    act(() => {
      promise1 = result.current.loadMore();
      promise2 = result.current.loadMore();
    });

    // Only one executeMutation call should have gone through
    expect(executeMutation).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch();
      await promise1!;
      await promise2!;
    });
  });
});
