import type { RecognizedLine, RecognizedPage } from '#/native/TextRecognition';

const centerOf = (line: RecognizedLine) => line.y + line.height / 2;

// One printed row when the centres sit within half the shorter line's height.
const onSameRow = (a: RecognizedLine, b: RecognizedLine) =>
  Math.abs(centerOf(a) - centerOf(b)) < Math.min(a.height, b.height) / 2;

// Recognition reads some Latin letters as their Cyrillic twins (`TAХ`, ALDI's
// tax flag `4.38 А`) and ends a figure with a run of noise (`BALANCE
// 154.7îźś`). Both are undone only on a page printed mostly in Latin letters.
const CYRILLIC_TWINS = 'АВЕКМНОРСТХУаеорсух';
const LATIN_TWINS = 'ABEKMHOPCTXYaeopcyx';
const CYRILLIC_TWIN = /[АВЕКМНОРСТХУаеорсух]/g;
const NOISE_AFTER_FIGURE = /(\d-?(?:\s?[A-Z]{1,2})?)\s?[\u0080-\uFFFF]+$/;

const countOf = (text: string, letters: RegExp) =>
  text.match(letters)?.length ?? 0;

const isMostlyLatin = (lines: readonly RecognizedLine[]) => {
  const text = lines.map(line => line.text).join(' ');
  return (
    countOf(text, /[A-Za-z\u00C0-\u024F]/g) > countOf(text, /[\u0400-\u04FF]/g)
  );
};

const cleanLatin = (text: string) =>
  text
    .replace(
      CYRILLIC_TWIN,
      letter => LATIN_TWINS[CYRILLIC_TWINS.indexOf(letter)] ?? letter,
    )
    .replace(NOISE_AFTER_FIGURE, '$1');

/**
 * Rebuilds each page's printed rows, top to bottom. Text recognition returns a
 * receipt's price column apart from the item names, so a row is re-joined from
 * the lines beside each other, left to right, two spaces marking the gap.
 */
export function assembleReceiptLines(
  pages: readonly RecognizedPage[],
): string[][] {
  return pages.map(page => {
    const clean = isMostlyLatin(page.lines)
      ? cleanLatin
      : (text: string) => text;
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
        .map(line => clean(line.text.trim()))
        .join('  '),
    );
  });
}
