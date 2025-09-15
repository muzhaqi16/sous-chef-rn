import {useMemo, useState} from 'react';

/**
 * A custom hook that provides a searchable list functionality.
 *
 * @param items - The list of items to filter (can be undefined or null).
 * @param filterFn - A function that determines if an item matches the search query.
 */
export function useSearchableList<T>(
  items: T[] | null | undefined,
  filterFn: (item: T, query: string) => boolean,
) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    // ensure we have an array
    const list = Array.isArray(items) ? items : [];
    return list.filter(item => filterFn(item, query));
  }, [items, query, filterFn]);

  return {query, setQuery, filtered};
}
