/** A scanned product and the concepts above it, nearest first. */
export interface ScannedProductRef {
  id: string;
  conceptIds: readonly string[];
}

interface LineWithItem {
  item: { id: string } | null;
}

/**
 * The line a scanned product fulfils: the one naming the product itself, else
 * the one naming the nearest concept above it, as cooking matches a stack to an
 * ingredient. A line already in the cart counts only when none left to buy does.
 */
export function matchScannedLine<TLine extends LineWithItem>(
  toBuy: readonly TLine[],
  inCart: readonly TLine[],
  scanned: ScannedProductRef,
): { line: TLine; inCart: boolean } | null {
  const order = [scanned.id, ...scanned.conceptIds];
  const nearest = (lines: readonly TLine[]) => {
    for (const id of order) {
      const line = lines.find(candidate => candidate.item?.id === id);
      if (line) return line;
    }
    return null;
  };
  const open = nearest(toBuy);
  if (open) return { line: open, inCart: false };
  const done = nearest(inCart);
  return done ? { line: done, inCart: true } : null;
}
