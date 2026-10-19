import type { PhotoMask, RecognizedLine } from '#/native/TextRecognition';
import {
  measuredSlopeOf,
  textHeightOf,
  type ReceiptRow,
  type ReceiptRowsPage,
} from './assembleReceiptRows';
import { isItemLine } from './hasItemLines';
import { holdsDate } from './receiptDate';
import { rowRedactions, type RowRedaction } from './redactReceiptText';

// A card number whose digits recognition could not read: `XXXXXXXXXXXX  H`.
// Stars are left out: a row of them is often a rule above the totals.
const UNREAD_CARD = /^\W*[Xx•]{8,}\W*[A-Z]?\W*$/;

// A numbered field beside a date may be a payment one recognition misread
// (`Ref/Seg # 298192`).
const NUMBERED_FIELD = /#\s*\d/;

// How far a mask reaches past its text, as a share of the text's height.
const MARGIN = 0.3;

// Far enough past a page's edge for any tilt to clear it.
const PAST_EDGE = 2;

type Point = readonly [x: number, y: number];

const ownTextHeight = (line: RecognizedLine) =>
  textHeightOf(line, line.slope ?? 0);

interface TextEdges {
  top: [left: Point, right: Point];
  bottom: [left: Point, right: Point];
}

// A tilted line's box has room above one end of its text and below the other.
const edgesOf = ({
  x,
  y,
  width,
  height,
  slope = 0,
}: RecognizedLine): TextEdges => {
  const rise = Math.min(Math.abs(slope) * width, height);
  const right = x + width;
  const bottom = y + height;
  return slope >= 0
    ? {
        top: [
          [x, y],
          [right, y + rise],
        ],
        bottom: [
          [x, bottom - rise],
          [right, bottom],
        ],
      }
    : {
        top: [
          [x, y + rise],
          [right, y],
        ],
        bottom: [
          [x, bottom],
          [right, bottom - rise],
        ],
      };
};

// A band's edge, by its height where it meets the page's left and right edges.
type Edge = readonly [left: number, right: number];

const PAGE_TOP: Edge = [-PAST_EDGE, -PAST_EDGE];
const PAGE_END: Edge = [PAST_EDGE, PAST_EDGE];

const heightAt = ([left, right]: Edge, x: number) => left + (right - left) * x;

const lower = (a: Edge, b: Edge): Edge => [
  Math.max(a[0], b[0]),
  Math.max(a[1], b[1]),
];

// A curled receipt's rows tilt more than its page: each edge follows its row,
// along its widest line, as in assembly.
const slopeOf = (lines: readonly RecognizedLine[], tilt: number) => {
  const widest = lines.reduce((wide, line) =>
    line.width > wide.width ? line : wide,
  );
  return measuredSlopeOf(widest) ?? tilt;
};

// The edge along `slope` that clears every point, on the side `pick` chooses.
const edgeOf = (
  points: readonly Point[],
  slope: number,
  pick: (...offsets: number[]) => number,
): Edge => {
  const offset = pick(...points.map(([x, y]) => y - slope * x));
  return [offset, offset + slope];
};

const topOf = (lines: readonly RecognizedLine[], tilt: number) =>
  edgeOf(
    lines.flatMap(line => edgesOf(line).top),
    slopeOf(lines, tilt),
    Math.min,
  );

const bottomOf = (lines: readonly RecognizedLine[], tilt: number) =>
  edgeOf(
    lines.flatMap(line => edgesOf(line).bottom),
    slopeOf(lines, tilt),
    Math.max,
  );

const band = (
  [topLeft, topRight]: Edge,
  [bottomLeft, bottomRight]: Edge,
): PhotoMask => ({
  points: [0, topLeft, 1, topRight, 1, bottomRight, 0, bottomLeft],
  margin: 0,
});

// The line's text, along its slope.
const boxOf = (line: RecognizedLine): PhotoMask => {
  const {
    top: [topLeft, topRight],
    bottom: [bottomLeft, bottomRight],
  } = edgesOf(line);
  return {
    points: [...topLeft, ...topRight, ...bottomRight, ...bottomLeft],
    margin: ownTextHeight(line) * MARGIN,
  };
};

// A date row in the payment block is left open, unless it holds more.
const staysOpen = ({ kind, text }: RowRedaction) =>
  kind === 'kept' && holdsDate(text) && !NUMBERED_FIELD.test(text);

// The band opens a margin above its first row, never into the row above it.
const regionTopOf = (
  first: ReceiptRow,
  above: ReceiptRow | null,
  tilt: number,
): Edge => {
  const [left, right] = topOf(first.lines, tilt);
  const reach = Math.max(...first.lines.map(ownTextHeight)) * MARGIN;
  const [limitLeft, limitRight] = above
    ? bottomOf(above.lines, tilt)
    : PAGE_TOP;
  return [
    Math.min(left, Math.max(left - reach, limitLeft)),
    Math.min(right, Math.max(right - reach, limitRight)),
  ];
};

interface Gap {
  top: Edge;
  bottom: Edge;
}

const reachesInto = (line: RecognizedLine, gap: Gap) => {
  const {
    top: [topLeft, topRight],
    bottom: [bottomLeft, bottomRight],
  } = edgesOf(line);
  const across = ([x, top]: Point, [, bottom]: Point) =>
    top < heightAt(gap.bottom, x) && bottom > heightAt(gap.top, x);
  return across(topLeft, bottomLeft) || across(topRight, bottomRight);
};

interface RegionRow {
  row: ReceiptRow;
  open: boolean;
}

// Full width from `top` past the page's end, but for the open rows. A covered
// line reaching into an open row is covered on its own.
function regionMasks(
  rows: readonly RegionRow[],
  top: Edge,
  tilt: number,
): PhotoMask[] {
  const gaps: Gap[] = rows
    .filter(({ open }) => open)
    .map(({ row }) => ({
      top: topOf(row.lines, tilt),
      bottom: bottomOf(row.lines, tilt),
    }));
  const masks: PhotoMask[] = [];
  let from = top;
  for (const gap of gaps) {
    masks.push(band(from, lower(from, gap.top)));
    from = lower(from, gap.bottom);
  }
  masks.push(band(from, PAGE_END));
  for (const { row, open } of rows) {
    if (open) continue;
    for (const line of row.lines) {
      if (gaps.some(gap => reachesInto(line, gap))) masks.push(boxOf(line));
    }
  }
  return masks;
}

/**
 * What to paint over each photo before it leaves the phone: the payment block as
 * one region (full width, to the end, date rows open) so a missed card digit is
 * covered, and each redacted row above. Null with no block read: a misread shows.
 */
export function receiptPhotoMasks(
  pages: readonly ReceiptRowsPage[],
): PhotoMask[][] | null {
  const redactions = rowRedactions(
    pages.map(({ rows }) => rows.map(row => row.text)),
  );
  let pastHeader = false;
  let inRegion = false;
  const masks: PhotoMask[][] = [];
  for (const [at, { rows, tilt }] of pages.entries()) {
    const shapes: PhotoMask[] = [];
    let regionTop = inRegion ? PAGE_TOP : null;
    const region: RegionRow[] = [];
    let above: ReceiptRow | null = null;
    for (const [index, row] of rows.entries()) {
      const redaction = redactions[at]?.[index];
      if (!redaction) continue;
      const opensBlock =
        redaction.kind === 'payment' || UNREAD_CARD.test(row.text);
      if (!inRegion && (redaction.cut || (pastHeader && opensBlock))) {
        inRegion = true;
        regionTop = regionTopOf(row, above, tilt);
      }
      if (inRegion) {
        region.push({ row, open: staysOpen(redaction) });
      } else if (redaction.kind !== 'kept') {
        shapes.push(...row.lines.map(boxOf));
      }
      pastHeader ||= isItemLine(row.text);
      above = row;
    }
    if (regionTop !== null) {
      shapes.push(...regionMasks(region, regionTop, tilt));
    }
    masks.push(shapes);
  }
  return inRegion ? masks : null;
}
