import { renderHook, waitFor } from '@testing-library/react-native';
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
    const { result } = renderHook(() =>
      useLoadRemainingPages(true, false, state),
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
        useLoadRemainingPages(true, false, current),
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
        useLoadRemainingPages(enabled, false, state),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => expect(result.current).toBe(false), { timeout: 3000 });

    rerender({ enabled: false });
    rerender({ enabled: true });

    expect(result.current).toBe(true);
  });
});
