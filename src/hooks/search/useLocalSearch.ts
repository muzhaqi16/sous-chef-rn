/**
 * One local list search. Nine lists hand-rolled the same substring filter, each
 * deciding for itself what an empty term, a null field and whitespace mean.
 * SUBSTRING not fuzzy, because that is what they did — `searchUtils` is the
 * fuzzy path for a list that wants typo tolerance.
 */
type Accessor<T> = keyof T | ((item: T) => string | null | undefined);

const read = <T>(item: T, key: Accessor<T>): string | null | undefined => {
  if (typeof key === 'function') return key(item);
  const value = item[key];
  // A non-string field simply does not match, rather than stringifying into
  // something a search term could accidentally hit ("[object Object]").
  return typeof value === 'string' ? value : undefined;
};

/** One item against one term — for a compound filter that has other criteria. */
export function matchesTerm<T>(
  item: T,
  term: string,
  keys: ReadonlyArray<Accessor<T>>,
): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return keys.some(key => read(item, key)?.toLowerCase().includes(needle));
}

/**
 * Items where any accessor contains `term`. An empty term returns the ORIGINAL
 * array — same reference, so a list does not re-render on a cleared search box.
 */
export function filterByTerm<T>(
  items: readonly T[] | null | undefined,
  term: string,
  keys: ReadonlyArray<Accessor<T>>,
): readonly T[] {
  if (!items) return EMPTY;
  const needle = term.trim().toLowerCase();
  if (!needle) return items;
  return items.filter(item => matchesTerm(item, needle, keys));
}

const EMPTY: readonly never[] = [];

/** `filterByTerm` for a render path. The compiler memoizes the result. */
export function useLocalSearch<T>(
  items: readonly T[] | null | undefined,
  term: string,
  keys: ReadonlyArray<Accessor<T>>,
): readonly T[] {
  return filterByTerm(items, term, keys);
}

/** The item IS the string — folder names, tags. */
export const identity = <T>(value: T): T => value;
