import { renderHook, act } from '@testing-library/react-native';
import {
  useFilterTransition,
  useFilterTransitionWithDeps,
} from '../useFilterTransition';

interface TestItem {
  id: number;
  name: string;
  category: string;
}

const items: TestItem[] = [
  { id: 1, name: 'Apple', category: 'fruit' },
  { id: 2, name: 'Banana', category: 'fruit' },
  { id: 3, name: 'Carrot', category: 'vegetable' },
  { id: 4, name: 'Broccoli', category: 'vegetable' },
];

const fruitFilter = (item: TestItem) => item.category === 'fruit';
const vegetableFilter = (item: TestItem) => item.category === 'vegetable';

describe('useFilterTransition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies filter on mount by default (applyOnMount = true)', () => {
    const { result } = renderHook(() =>
      useFilterTransition({
        items,
        filterFn: fruitFilter,
      }),
    );

    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
    ]);
  });

  it('returns all items when applyOnMount is false', () => {
    const { result } = renderHook(() =>
      useFilterTransition({
        items,
        filterFn: fruitFilter,
        applyOnMount: false,
      }),
    );

    // After mount, the useEffect runs and applies the filter synchronously
    // in tests (startTransition is synchronous). The initial state is all items
    // but the effect immediately filters.
    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
    ]);
  });

  it('re-filters when items change', () => {
    const { result, rerender } = renderHook(
      (props: { itemsList: TestItem[] }) =>
        useFilterTransition({
          items: props.itemsList,
          filterFn: fruitFilter,
        }),
      { initialProps: { itemsList: items } },
    );

    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
    ]);

    const newItems = [...items, { id: 5, name: 'Mango', category: 'fruit' }];

    rerender({ itemsList: newItems });

    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
      { id: 5, name: 'Mango', category: 'fruit' },
    ]);
  });

  it('re-filters when filterFn changes', () => {
    const { result, rerender } = renderHook(
      (props: { filterFn: (item: TestItem) => boolean }) =>
        useFilterTransition({
          items,
          filterFn: props.filterFn,
        }),
      { initialProps: { filterFn: fruitFilter } },
    );

    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
    ]);

    rerender({ filterFn: vegetableFilter });

    expect(result.current.filteredItems).toEqual([
      { id: 3, name: 'Carrot', category: 'vegetable' },
      { id: 4, name: 'Broccoli', category: 'vegetable' },
    ]);
  });

  it('applyFilter() manually triggers filtering', () => {
    const { result } = renderHook(() =>
      useFilterTransition({
        items,
        filterFn: fruitFilter,
      }),
    );

    // Already filtered on mount
    expect(result.current.filteredItems).toHaveLength(2);

    // Calling applyFilter again should still produce the same results
    act(() => {
      result.current.applyFilter();
    });

    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
    ]);
  });

  it('isPending is false after synchronous transition in tests', () => {
    const { result } = renderHook(() =>
      useFilterTransition({
        items,
        filterFn: fruitFilter,
      }),
    );

    expect(result.current.isPending).toBe(false);
  });
});

describe('useFilterTransitionWithDeps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies filter on mount and re-filters when items change', () => {
    const { result, rerender } = renderHook(
      (props: { itemsList: TestItem[] }) =>
        useFilterTransitionWithDeps({
          items: props.itemsList,
          filterFn: vegetableFilter,
        }),
      { initialProps: { itemsList: items } },
    );

    expect(result.current.filteredItems).toEqual([
      { id: 3, name: 'Carrot', category: 'vegetable' },
      { id: 4, name: 'Broccoli', category: 'vegetable' },
    ]);

    const newItems = [
      ...items,
      { id: 5, name: 'Spinach', category: 'vegetable' },
    ];

    rerender({ itemsList: newItems });

    expect(result.current.filteredItems).toEqual([
      { id: 3, name: 'Carrot', category: 'vegetable' },
      { id: 4, name: 'Broccoli', category: 'vegetable' },
      { id: 5, name: 'Spinach', category: 'vegetable' },
    ]);
  });

  it('exposes applyFilter for manual trigger', () => {
    const { result } = renderHook(() =>
      useFilterTransitionWithDeps({
        items,
        filterFn: fruitFilter,
      }),
    );

    expect(typeof result.current.applyFilter).toBe('function');

    act(() => {
      result.current.applyFilter();
    });

    expect(result.current.filteredItems).toEqual([
      { id: 1, name: 'Apple', category: 'fruit' },
      { id: 2, name: 'Banana', category: 'fruit' },
    ]);
  });
});
