import type { RecognizedLine, RecognizedPage } from '#/native/TextRecognition';

const centerOf = (line: RecognizedLine) => line.y + line.height / 2;

// One printed row when the centres sit within half the shorter line's height.
const onSameRow = (a: RecognizedLine, b: RecognizedLine) =>
  Math.abs(centerOf(a) - centerOf(b)) < Math.min(a.height, b.height) / 2;

/**
 * Rebuilds each page's printed rows, top to bottom. Text recognition returns a
 * receipt's price column apart from the item names, so a row is re-joined from
 * the lines beside each other, left to right, two spaces marking the gap.
 */
export function assembleReceiptLines(
  pages: readonly RecognizedPage[],
): string[][] {
  return pages.map(page => {
    const rows: RecognizedLine[][] = [];
    const byCenter = page.lines
      .filter(line => line.text.trim() !== '')
      .sort((a, b) => centerOf(a) - centerOf(b));
    for (const line of byCenter) {
      const row = rows.at(-1);
      const [first] = row ?? [];
      if (row && first && onSameRow(first, line)) row.push(line);
      else rows.push([line]);
    }
    return rows.map(row =>
      row
        .sort((a, b) => a.x - b.x)
        .map(line => line.text.trim())
        .join('  '),
    );
  });
}
