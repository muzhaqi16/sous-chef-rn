import { filterByTerm } from '#hooks/search/useLocalSearch';
/** The shared `filterFallback` for the autocomplete hooks. */
export function filterByName<T extends { name: string }>(
  term: string,
  items: readonly T[],
): T[] {
  return filterByTerm(items, term, ['name']) as T[];
}
