/** Where one suggestion sat in one list, so it can go back exactly there. */
export interface SuggestionRemoval<T> {
  readonly index: number;
  readonly entry: T;
}

/** The list without the item, and where it sat; `null` when it was absent. */
export function takeSuggestion<T extends { readonly itemId: string }>(
  list: readonly T[],
  itemId: string,
): { list: T[]; removal: SuggestionRemoval<T> | null } {
  const index = list.findIndex(entry => entry.itemId === itemId);
  const entry = list[index];
  return {
    list: list.filter(candidate => candidate.itemId !== itemId),
    removal: entry ? { index, entry } : null,
  };
}

/**
 * The list with the entry back at its old index, or at the end of a list that
 * has since shrunk. A list that holds the item again (a refetch brought it
 * back) is left as it is.
 */
export function putSuggestionBack<T extends { readonly itemId: string }>(
  list: readonly T[],
  removal: SuggestionRemoval<T> | null,
): T[] {
  if (!removal || list.some(entry => entry.itemId === removal.entry.itemId)) {
    return [...list];
  }
  const at = Math.min(removal.index, list.length);
  return [...list.slice(0, at), removal.entry, ...list.slice(at)];
}
