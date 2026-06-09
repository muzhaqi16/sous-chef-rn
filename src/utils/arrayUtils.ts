/**
 * Dedupe a list by `id`, keeping the first occurrence of each id (input order
 * is preserved). Optionally cap the result to the first `max` unique items.
 *
 * Used both for the seen-items LRU merge (`appSlice.addCachedItemSuggestions`,
 * with a cap) and the brand autocomplete fallback merge (suggested + warmed
 * cache, no cap).
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

/**
 * Case-insensitive "name contains term" filter — the shared `filterFallback`
 * for the autocomplete hooks (store / category / brand / item). Matches when an
 * item's `name` includes `term`, both lowercased.
 */
export function filterByName<T extends { name: string }>(
  term: string,
  items: readonly T[],
): T[] {
  const lower = term.toLowerCase();
  return items.filter(item => item.name.toLowerCase().includes(lower));
}
