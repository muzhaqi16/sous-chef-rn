import { renderHook, act } from '@testing-library/react-native';
import { useSearchableList } from '../useSearchableList';

const items = [
  { name: 'Apple' },
  { name: 'Banana' },
  { name: 'Avocado' },
  { name: 'Blueberry' },
];

const filterFn = (item: { name: string }, query: string) =>
  item.name.toLowerCase().includes(query.toLowerCase());

describe('useSearchableList', () => {
  it('returns all items initially', () => {
    const { result } = renderHook(() => useSearchableList(items, filterFn));
    expect(result.current.filtered).toEqual(items);
    expect(result.current.totalCount).toBe(4);
    expect(result.current.resultCount).toBe(4);
  });

  it('filters items when query is set', () => {
    const { result } = renderHook(() => useSearchableList(items, filterFn));

    act(() => {
      result.current.setQuery('a');
    });

    // 'a' matches Apple, Banana, Avocado
    expect(result.current.filtered).toHaveLength(3);
    expect(result.current.isFiltering).toBe(true);
  });

  it('clears query resets to all items', () => {
    const { result } = renderHook(() => useSearchableList(items, filterFn));

    act(() => {
      result.current.setQuery('apple');
    });
    expect(result.current.filtered).toHaveLength(1);

    act(() => {
      result.current.clearQuery();
    });
    expect(result.current.filtered).toEqual(items);
    expect(result.current.query).toBe('');
  });

  it('handles null items', () => {
    const { result } = renderHook(() => useSearchableList(null, filterFn));
    expect(result.current.filtered).toEqual([]);
    expect(result.current.totalCount).toBe(0);
  });

  it('handles undefined items', () => {
    const { result } = renderHook(() => useSearchableList(undefined, filterFn));
    expect(result.current.filtered).toEqual([]);
  });

  it('respects minQueryLength', () => {
    const { result } = renderHook(() =>
      useSearchableList(items, filterFn, { minQueryLength: 3 }),
    );

    act(() => {
      result.current.setQuery('ap');
    });
    // Query too short, returns all items
    expect(result.current.filtered).toEqual(items);
    expect(result.current.isFiltering).toBe(false);

    act(() => {
      result.current.setQuery('app');
    });
    // Now long enough
    expect(result.current.filtered).toHaveLength(1);
    expect(result.current.isFiltering).toBe(true);
  });

  it('reports correct counts', () => {
    const { result } = renderHook(() => useSearchableList(items, filterFn));

    act(() => {
      result.current.setQuery('blue');
    });

    expect(result.current.resultCount).toBe(1);
    expect(result.current.totalCount).toBe(4);
  });
});
