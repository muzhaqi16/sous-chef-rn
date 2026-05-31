/**
 * Find an item by its `key` field, throwing if absent.
 *
 * `Array.prototype.find` returns `T | undefined`, forcing every test that
 * looks up a config-driven item (settings rows, menu entries, …) to either
 * guard or non-null-assert before reading fields. This helper narrows to `T`
 * centrally and fails loudly with the missing key — a clearer signal than the
 * downstream "Cannot read property of undefined" that an unguarded `.find()`
 * produces at runtime.
 */
export function findByKey<T extends { key: string }>(
  items: readonly T[],
  key: string,
): T {
  const found = items.find(item => item.key === key);
  if (!found) {
    throw new Error(`findByKey: no item with key "${key}"`);
  }
  return found;
}
