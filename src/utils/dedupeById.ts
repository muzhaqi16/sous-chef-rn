/**
 * Dedupe by `id`, keeping the first occurrence and input order; `max` caps the
 * result.
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
