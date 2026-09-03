import { filterByTerm } from '#hooks/search/useLocalSearch';
/**
 * Dedupe by `id`, keeping the first occurrence and input order; `max` caps the
 * result. Used by the seen-items LRU merge and the brand autocomplete fallback.
 */
export function dedupeById<T extends { id: string }>(
  items: readonly T[],
  max?: number,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
    if (max !== undefined && result.length >= max) break;
  }
  return result;
}

/** The shared `filterFallback` for the autocomplete hooks. */
export function filterByName<T extends { name: string }>(
  term: string,
  items: readonly T[],
): T[] {
  return filterByTerm(items, term, ['name']) as T[];
}
