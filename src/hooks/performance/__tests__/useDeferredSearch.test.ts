import { renderHook, act } from '@testing-library/react-native';
import {
  useDeferredSearch,
  useDeferredSearchWithSort,
} from '../useDeferredSearch';

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

  it('returns deferredQuery matching searchQuery in synchronous test env', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: 'cherry',
        searchFn,
      }),
    );

    expect(result.current.deferredQuery).toBe('cherry');
  });

  it('returns isStale as false in synchronous test env', () => {
    const { result } = renderHook(() =>
      useDeferredSearch({
        items,
        searchQuery: 'banana',
        searchFn,
      }),
    );

    expect(result.current.isStale).toBe(false);
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
      expect(result.current.isStale).toBe(true);
      expect(result.current.results).toEqual([{ id: 1, name: 'Apple' }]);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.isStale).toBe(false);
      expect(result.current.results).toEqual([
        { id: 2, name: 'Banana' },
        { id: 4, name: 'Blueberry' },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('useDeferredSearchWithSort', () => {
  it('sorts results when sortFn is provided', () => {
    const sortFn = (a: TestItem, b: TestItem) => b.name.localeCompare(a.name); // reverse alphabetical

    const { result } = renderHook(() =>
      useDeferredSearchWithSort({
        items,
        searchQuery: 'b',
        searchFn,
        sortFn,
      }),
    );

    expect(result.current.results).toEqual([
      { id: 4, name: 'Blueberry' },
      { id: 2, name: 'Banana' },
    ]);
  });

  it('returns unsorted results when no sortFn is provided', () => {
    const { result } = renderHook(() =>
      useDeferredSearchWithSort({
        items,
        searchQuery: 'a',
        searchFn,
      }),
    );

    // Matches Apple, Banana, Avocado — original order preserved
    expect(result.current.results).toEqual([
      { id: 1, name: 'Apple' },
      { id: 2, name: 'Banana' },
      { id: 3, name: 'Avocado' },
    ]);
  });

  it('returns all items sorted when query is empty and sortFn is provided', () => {
    const sortFn = (a: TestItem, b: TestItem) => a.name.localeCompare(b.name); // alphabetical

    const { result } = renderHook(() =>
      useDeferredSearchWithSort({
        items,
        searchQuery: '',
        searchFn,
        sortFn,
        minQueryLength: 1,
      }),
    );

    expect(result.current.results).toEqual([
      { id: 1, name: 'Apple' },
      { id: 3, name: 'Avocado' },
      { id: 2, name: 'Banana' },
      { id: 4, name: 'Blueberry' },
      { id: 5, name: 'Cherry' },
    ]);
  });
});
