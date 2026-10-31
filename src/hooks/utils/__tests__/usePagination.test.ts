'use no memo';

import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import { CombinedGraphQLErrors } from '@apollo/client/errors';
import { GraphQLError } from 'graphql';
import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { usePagination } from '../usePagination';

jest.mock('#/services/errorService');

const mockFetchPage = jest.fn();
jest.mock('#hooks/utils/fetchPage', () => ({
  fetchPage: (...args: unknown[]) => mockFetchPage(...args),
}));
const OBSERVABLE = {
  query: gql`
    query Page {
      me {
        id
      }
    }
  `,
  variables: {},
};

const renderHook = <TResult, TProps>(
  callback: (props: TProps) => TResult,
  options: { initialProps?: TProps } = {},
) => renderHookWithApollo(callback, { operationMocks: [], ...options });

describe('usePagination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPage.mockResolvedValue({});
  });

  it('hasMore reflects pageInfo.hasNextPage', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        loading: false,
        itemCount: 10,
        observable: OBSERVABLE,
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
        observable: OBSERVABLE,
      }),
    );

    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore() asks for the page with cursor and variables', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        observable: OBSERVABLE,
        fetchMoreVariables: { id: 'list-1' },
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchPage).toHaveBeenCalledWith(expect.anything(), OBSERVABLE, {
      id: 'list-1',
      cursor: 'cursor-abc',
    });
  });

  it('loadMore() uses custom cursorVariableName', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-xyz' },
        loading: false,
        itemCount: 10,
        observable: OBSERVABLE,
        cursorVariableName: 'itemsCursor',
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchPage).toHaveBeenCalledWith(expect.anything(), OBSERVABLE, {
      itemsCursor: 'cursor-xyz',
    });
  });

  it('restarts when the server refuses a cursor the connection names its own way', async () => {
    // The pantry is the one caller that supplies `restart`, and its cursor
    // argument is `itemsCursor` — so a recogniser keyed on `after`/`cursor`
    // leaves exactly that list stranded at the page it stopped on.
    const refusal = new CombinedGraphQLErrors({
      errors: [
        new GraphQLError('Invalid cursor.', {
          extensions: { code: 'VALIDATION_FAILED' },
        }),
      ],
    });
    mockFetchPage.mockRejectedValueOnce(refusal);
    const restart = jest.fn().mockResolvedValue({});

    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'stale-cursor' },
        loading: false,
        itemCount: 10,
        observable: OBSERVABLE,
        cursorVariableName: 'itemsCursor',
        restart,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(restart).toHaveBeenCalledTimes(1);
    expect(result.current.loadMoreError).toBe(false);
  });

  it('loadMore() does nothing when hasMore is false', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: false, endCursor: 'cursor-abc' },
        loading: false,
        itemCount: 10,
        observable: OBSERVABLE,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchPage).not.toHaveBeenCalled();
  });

  it('loadMore() does nothing when loading is true', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
        loading: true,
        itemCount: 10,
        observable: OBSERVABLE,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchPage).not.toHaveBeenCalled();
  });

  it('loadMore() does nothing when endCursor is null', async () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: null },
        loading: false,
        itemCount: 10,
        observable: OBSERVABLE,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    expect(mockFetchPage).not.toHaveBeenCalled();
  });

  it('isLoadingMore is false during initial load even with cached items', () => {
    const { result } = renderHook(() =>
      usePagination({
        pageInfo: { hasNextPage: true, endCursor: 'abc' },
        loading: true,
        itemCount: 5,
        observable: OBSERVABLE,
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
        observable: OBSERVABLE,
      }),
    );

    expect(result.current.isLoadingMore).toBe(false);
  });

  it('isLoadingMore is true during a page and false after', async () => {
    let resolveFetch!: () => void;
    mockFetchPage.mockImplementationOnce(
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
        observable: OBSERVABLE,
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

  it('opens for the next page after one that settles in a single render', async () => {
    const raf = jest
      .spyOn(globalThis, 'requestAnimationFrame')
      .mockImplementation(run => {
        run(0);
        return 1;
      });
    try {
      mockFetchPage.mockRejectedValueOnce(new Error('network unavailable'));
      const { result } = renderHook(() =>
        usePagination({
          pageInfo: { hasNextPage: true, endCursor: 'cursor-abc' },
          loading: false,
          itemCount: 10,
          observable: OBSERVABLE,
        }),
      );

      await act(async () => {
        await result.current.loadMore();
      });
      await act(async () => {
        await result.current.loadMore();
      });

      expect(mockFetchPage).toHaveBeenCalledTimes(2);
    } finally {
      raf.mockRestore();
    }
  });

  it('loadMore() does nothing when already fetching more', async () => {
    let resolveFetch!: () => void;
    mockFetchPage.mockImplementationOnce(
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
        observable: OBSERVABLE,
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

    expect(mockFetchPage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch();
      await loadMorePromise!;
    });
  });

  it('ref guard stays active until re-render prevents stale-closure loadMore', async () => {
    // Simulates: the page resolves → isFetchingMore=false scheduled → before
    // re-render, onEndReached fires again with stale hasMore=true/endCursor.
    // The ref should still be true until the useEffect clears it post-render.
    let resolveFetch!: () => void;
    mockFetchPage.mockImplementationOnce(
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
          observable: OBSERVABLE,
        }),
      { initialProps: { hasMore: true, endCursor: 'cursor-60' } },
    );

    // Start first loadMore
    let loadMorePromise: Promise<void>;
    act(() => {
      loadMorePromise = result.current.loadMore();
    });
    expect(mockFetchPage).toHaveBeenCalledTimes(1);

    // The page resolves — but DON'T let React re-render yet
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
    expect(mockFetchPage).toHaveBeenCalledTimes(1);
  });

  it('concurrent loadMore calls: ref guard prevents duplicate fetches even before state updates', async () => {
    // The page is slow so both calls overlap
    let resolveFetch!: () => void;
    mockFetchPage.mockImplementation(
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
        observable: OBSERVABLE,
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

    // Only one page should have gone through
    expect(mockFetchPage).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch();
      await promise1!;
      await promise2!;
    });
  });

  it('a page settling does not immediately re-open loadMore for the next page', async () => {
    // The append and `setIsFetchingMore(false)` batch into one commit, and
    // `endCursor` has already advanced by then. Releasing the guard inside that
    // commit let a fling's next onEndReached start page N+1 while page N was
    // still mounting, so two pages landed together. The guard must survive the
    // settling commit and only lift a frame later.
    const raf = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(() => 1);

    try {
      mockFetchPage.mockResolvedValue({});

      const { result, rerender } = renderHook(
        (props: { endCursor: string }) =>
          usePagination({
            pageInfo: { hasNextPage: true, endCursor: props.endCursor },
            loading: false,
            itemCount: 25,
            observable: OBSERVABLE,
          }),
        { initialProps: { endCursor: 'cursor-25' } },
      );

      await act(async () => {
        await result.current.loadMore();
      });
      expect(mockFetchPage).toHaveBeenCalledTimes(1);

      // Apollo publishes the merged page: more rows, cursor moved on.
      rerender({ endCursor: 'cursor-50' });

      // The frame has not run yet, so the next page must still be refused even
      // though hasMore is true and the cursor is fresh.
      await act(async () => {
        await result.current.loadMore();
      });
      expect(mockFetchPage).toHaveBeenCalledTimes(1);

      // Once the frame runs, pagination resumes normally.
      const release = raf.mock.calls.at(-1)?.[0];
      act(() => release?.(0));

      await act(async () => {
        await result.current.loadMore();
      });
      expect(mockFetchPage).toHaveBeenCalledTimes(2);
      expect(mockFetchPage).toHaveBeenLastCalledWith(
        expect.anything(),
        OBSERVABLE,
        { cursor: 'cursor-50' },
      );
    } finally {
      raf.mockRestore();
    }
  });
});
