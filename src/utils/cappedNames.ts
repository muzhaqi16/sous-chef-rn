/** How many names a message lists before the rest become a count. */
const NAME_CAP = 3;

/** The first names a message lists, joined, and how many of `total` they leave out. */
export function cappedNames(
  names: readonly string[],
  total: number = names.length,
): { shown: string; remainder: number } {
  const listed = names.slice(0, NAME_CAP);
  return { shown: listed.join(', '), remainder: total - listed.length };
}
