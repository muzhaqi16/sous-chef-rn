import type { RecognizedLine, RecognizedPage } from '#/native/TextRecognition';

// A photo held at an angle tilts every printed row, and a curled receipt tilts
// each row differently: the name and its price sit at different heights on
// the page. A line reads its rows along the slope of the lines nearest it,
// weighted by width: a short line's own slope is noise (Giant Eagle's prices
// read three times the tilt of their names; `126817šę` a third less).
const SLOPED_LINE = 0.07;
const NEIGHBOURS = 5;
// Steeper than this is text running down the margin (Costco's tax flags).
const MAX_SLOPE = 0.5;

interface MeasuredSlope {
  centerY: number;
  slope: number;
  width: number;
}

const centerYOf = (line: RecognizedLine) => line.y + line.height / 2;

/** The slopes of the lines long enough to measure, by height on the page. */
function measuredSlopes(lines: readonly RecognizedLine[]): MeasuredSlope[] {
  return lines.flatMap(line => {
    const { slope } = line;
    return line.width >= SLOPED_LINE &&
      slope !== undefined &&
      Math.abs(slope) <= MAX_SLOPE
      ? [{ centerY: centerYOf(line), slope, width: line.width }]
      : [];
  });
}

// The slope half the nearby width agrees on.
const weightedMedian = (slopes: readonly MeasuredSlope[]) => {
  const sorted = [...slopes].sort((a, b) => a.slope - b.slope);
  const half = sorted.reduce((sum, { width }) => sum + width, 0) / 2;
  let seen = 0;
  for (const { slope, width } of sorted) {
    seen += width;
    if (seen >= half) return slope;
  }
  return 0;
};

const slopeNear = (centerY: number, slopes: readonly MeasuredSlope[]) =>
  weightedMedian(
    [...slopes]
      .sort(
        (a, b) => Math.abs(a.centerY - centerY) - Math.abs(b.centerY - centerY),
      )
      .slice(0, NEIGHBOURS),
  );

interface Placed {
  line: RecognizedLine;
  centerX: number;
  centerY: number;
  /** Height along the page's median slope, the order rows are read in. */
  row: number;
  /** The slope of the rows around it. */
  slope: number;
  /** The text's own height; a tilted line's box is taller by its rise. */
  textHeight: number;
}

const place = (
  line: RecognizedLine,
  tilt: number,
  slopes: readonly MeasuredSlope[],
): Placed => {
  const centerX = line.x + line.width / 2;
  const centerY = centerYOf(line);
  const slope = slopeNear(centerY, slopes);
  return {
    line,
    centerX,
    centerY,
    row: centerY - tilt * centerX,
    slope,
    textHeight: Math.max(
      line.height - Math.abs(slope) * line.width,
      line.height / 3,
    ),
  };
};

// How far apart two lines sit across the wider one's slope, in halves of the
// shorter text's height: under 1 is one printed row.
const rowGap = (a: Placed, b: Placed) => {
  const { slope } = a.line.width >= b.line.width ? a : b;
  const apart = b.centerY - a.centerY - slope * (b.centerX - a.centerX);
  return Math.abs(apart) / (Math.min(a.textHeight, b.textHeight) / 2);
};

// Where a receipt curls, the page's tilt reads its rows a little out of order,
// so a line joins whichever of the last few rows it fits best, measured from
// each row's widest line: measured from any member, tight rows chain.
const OPEN_ROWS = 3;

const widestOf = (row: readonly Placed[]) =>
  row.reduce((widest, placed) =>
    placed.line.width > widest.line.width ? placed : widest,
  );

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

// Recognition can split a figure after its decimal mark (`. 73`, `, 9999`). A
// space before the mark parts two printed figures (`1  . 9999` is a count and
// a price), so only the space after it goes.
const SPLIT_FIGURE = /(^|[\s$\d])([.,])\s+(\d{2,4})(?![\d.,])/g;

const joinSplitFigures = (text: string) => text.replace(SPLIT_FIGURE, '$1$2$3');

// A receipt that prints its prices as `$3.49` can read one `$` as an 8
// (Shop 'n Save's `$1.50` as `81.50`). Only a trailing price is read back.
const DOLLAR_AMOUNT = /\$\d+[.,]\d{2}/g;
const BARE_AMOUNT = /(?<![\d$.,])\d+[.,]\d{2}(?!\d)/g;
const EIGHT_FOR_DOLLAR = /(?<=\s)8(\d{1,3}[.,]\d{2})(?=\s*[A-Z*]{0,2}\s*$)/;

const printsDollars = (rows: readonly string[]) => {
  const dollars = rows.reduce(
    (sum, row) => sum + countOf(row, DOLLAR_AMOUNT),
    0,
  );
  const bare = rows.reduce((sum, row) => sum + countOf(row, BARE_AMOUNT), 0);
  return dollars >= 3 && dollars > bare;
};

// Under this tilt a page reads its rows by height alone: there the slopes are
// the paper's curl, not the photo's angle (Pak'nSave's names read -0.03 on
// rows that are level across the page).
const LEVEL = 0.025;

// One printed row when the centres sit within half the shorter line's height.
function levelRows(lines: readonly RecognizedLine[]): RecognizedLine[][] {
  const rows: RecognizedLine[][] = [];
  for (const line of [...lines].sort((a, b) => centerYOf(a) - centerYOf(b))) {
    const row = rows.at(-1);
    const [first] = row ?? [];
    const sameRow =
      first &&
      Math.abs(centerYOf(first) - centerYOf(line)) <
        Math.min(first.height, line.height) / 2;
    if (row && sameRow) row.push(line);
    else rows.push([line]);
  }
  return rows;
}

function tiltedRows(
  lines: readonly RecognizedLine[],
  tilt: number,
  slopes: readonly MeasuredSlope[],
): RecognizedLine[][] {
  const rows: Placed[][] = [];
  const byRow = lines
    .map(line => place(line, tilt, slopes))
    .sort((a, b) => a.row - b.row);
  for (const placed of byRow) {
    const [best] = rows
      .slice(-OPEN_ROWS)
      .map(row => ({ row, gap: rowGap(widestOf(row), placed) }))
      .filter(({ gap }) => gap < 1)
      .sort((a, b) => a.gap - b.gap);
    if (best) best.row.push(placed);
    else rows.push([placed]);
  }
  return rows.map(row => row.map(({ line }) => line));
}

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
    const lines = page.lines.filter(line => line.text.trim() !== '');
    const slopes = measuredSlopes(lines);
    const tilt = weightedMedian(slopes);
    const rows =
      Math.abs(tilt) < LEVEL
        ? levelRows(lines)
        : tiltedRows(lines, tilt, slopes);
    const texts = rows.map(row =>
      row
        .sort((a, b) => a.x - b.x)
        .map(line => clean(joinSplitFigures(line.text.trim())))
        .join('  '),
    );
    return printsDollars(texts)
      ? texts.map(text => text.replace(EIGHT_FOR_DOLLAR, '$$$1'))
      : texts;
  });
}
