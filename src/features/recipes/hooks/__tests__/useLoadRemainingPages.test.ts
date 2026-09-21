import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useLoadRemainingPages } from '../useLoadRemainingPages';

/**
 * While the network is withheld, `offlineModeLink` answers a cursor fetch from
 * the cache with the same merged connection: the request settles, nothing
 * advances, and `hasMore` stays true. A loop that reads "answered" as
 * "advanced" re-fires every frame behind a spinner that never clears.
 */

type PageState = Parameters<typeof useLoadRemainingPages>[2];

const page = (
  overrides: Partial<Omit<PageState, 'loadMore'>> & {
    loadMore?: jest.Mock<Promise<void>, []>;
  },
) => ({
  items: ['a', 'b'] as unknown[],
  hasMore: true,
  isLoadingMore: false,
  loadMoreError: false,
  loadMore: jest.fn<Promise<void>, []>(() => Promise.resolve()),
  ...overrides,
});

describe('loading the rest of a collection', () => {
  it('stops when a page settles without adding anything', async () => {
    const state = page({});
    const { result } = renderHook(
      () =>
        useLoadRemainingPages(true, false, state, '').isLoadingRemainingPages,
    );

    await waitFor(() => expect(result.current).toBe(false), { timeout: 3000 });
    const calls = state.loadMore.mock.calls.length;

    // Nothing re-fires once it has stalled.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(state.loadMore.mock.calls.length).toBe(calls);
    // Bounded: a few tries tolerate a swallowed call, then it stops.
    expect(calls).toBeLessThanOrEqual(4);
  });

  it('keeps going while pages add rows', async () => {
    const items = ['a'];
    const state = page({
      items,
      loadMore: jest.fn<Promise<void>, []>(() => {
        items.push(`row-${items.length}`);
        return Promise.resolve();
      }),
    });
    const { result, rerender } = renderHook(
      ({ current }: { current: PageState }) =>
        useLoadRemainingPages(true, false, current, '').isLoadingRemainingPages,
      { initialProps: { current: state } },
    );

    await waitFor(() => expect(state.loadMore).toHaveBeenCalled());
    rerender({ current: { ...state, items: [...items] } });

    expect(result.current).toBe(true);
  });

  it('tries again once the loop is switched off and on', async () => {
    const state = page({});
    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useLoadRemainingPages(enabled, false, state, '')
          .isLoadingRemainingPages,
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current).toBe(false), { timeout: 3000 });

    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(result.current).toBe(true);
  });
});

describe('a load-all that stops on a failed page', () => {
  it('reports the results as incomplete', () => {
    const state = page({ loadMoreError: true });
    const { result } = renderHook(() =>
      useLoadRemainingPages(true, false, state, 'term'),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        isLoadingRemainingPages: false,
        incomplete: true,
      }),
    );
  });

  it('is not incomplete once every page has loaded', () => {
    const state = page({ hasMore: false, loadMoreError: true });
    const { result } = renderHook(() =>
      useLoadRemainingPages(true, false, state, 'term'),
    );

    expect(result.current.incomplete).toBe(false);
  });

  it('starts again for a new search term', async () => {
    const state = page({ loadMoreError: true });
    const { rerender } = renderHook(
      ({ term }: { term: string }) =>
        useLoadRemainingPages(true, false, state, term),
      { initialProps: { term: 'app' } },
    );
    expect(state.loadMore).not.toHaveBeenCalled();

    rerender({ term: 'apple' });

    await waitFor(() => expect(state.loadMore).toHaveBeenCalled());
  });

  it('starts again on retry', async () => {
    const state = page({ loadMoreError: true });
    const { result } = renderHook(() =>
      useLoadRemainingPages(true, false, state, 'term'),
    );
    expect(state.loadMore).not.toHaveBeenCalled();

    act(() => result.current.retry());

    await waitFor(() => expect(state.loadMore).toHaveBeenCalled());
  });

  it('stops again when the retried page fails too', async () => {
    const state = page({ loadMoreError: true });
    const { result } = renderHook(() =>
      useLoadRemainingPages(true, false, state, 'term'),
    );

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.incomplete).toBe(true));
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(state.loadMore).toHaveBeenCalledTimes(1);
  });
});
