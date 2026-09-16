import { renderHook, act } from '@testing-library/react-native';
import { useDeferredSearch } from '#features/recipes/hooks/useDeferredSearch';

interface TestItem {
  id: number;
  name: string;
}

const items: TestItem[] = [
  { id: 1, name: 'Apple' },
  { id: 2, name: 'Banana' },
  { id: 3, name: 'Avocado' },
  { id: 4, name: 'Blueberry' },
  { id: 5, name: 'Cherry' },
];

const searchFn = (item: TestItem, query: string) =>
  item.name.toLowerCase().includes(query.toLowerCase());

describe('useDeferredSearch', () => {
  it('returns all items when query is empty', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: '',
        searchFn,
      }),
    );

    expect(result.current.results).toEqual(items);
  });

  it('returns all items when query is shorter than minQueryLength', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: 'ab',
        searchFn,
        minQueryLength: 3,
      }),
    );

    expect(result.current.results).toEqual(items);
  });

  it('filters items using searchFn when query meets minQueryLength', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: 'app',
        searchFn,
        minQueryLength: 3,
      }),
    );

    expect(result.current.results).toEqual([{ id: 1, name: 'Apple' }]);
  });

  it('filters items using searchFn with default minQueryLength of 0', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: 'b',
        searchFn,
      }),
    );

    expect(result.current.results).toEqual([
      { id: 2, name: 'Banana' },
      { id: 4, name: 'Blueberry' },
    ]);
  });

  it('trims whitespace from query before filtering', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: '  apple  ',
        searchFn,
      }),
    );

    expect(result.current.results).toEqual([{ id: 1, name: 'Apple' }]);
  });

  it('updates results when searchQuery changes, after the debounce', () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = renderHook(
        (props: { query: string }) =>
          useDeferredSearch({
            items,
            searchQuery: props.query,
            searchFn,
          }),
        { initialProps: { query: 'apple' } },
      );

      act(() => {
        jest.advanceTimersByTime(200);
      });
      expect(result.current.results).toEqual([{ id: 1, name: 'Apple' }]);

      rerender({ query: 'b' });

      // Results lag the query on purpose: the array feeds a FlashList `data`
      // prop, so it must not change during an interruptible render.
      expect(result.current.results).toEqual([{ id: 1, name: 'Apple' }]);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.results).toEqual([
        { id: 2, name: 'Banana' },
        { id: 4, name: 'Blueberry' },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
});
