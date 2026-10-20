import { assembleReceiptRows } from '../assembleReceiptRows';
import { receiptPhotoMasks } from '../receiptPhotoMasks';
import type {
  PhotoMask,
  RecognizedLine,
  RecognizedPage,
} from '#/types/textRecognition';

// One printed row per entry, a line pitch apart, each its own recognised line.
const ROW = 0.04;
const HEIGHT = 0.025;

const pageOf = (rows: string[], tilt = 0): RecognizedPage => ({
  lines: rows.map((text, at) => ({
    text,
    x: 0.1,
    // A tilted row's box grows by its rise; its top-left is the text's top.
    y: 0.05 + at * ROW + (tilt < 0 ? tilt * 0.8 : 0),
    width: 0.8,
    height: HEIGHT + Math.abs(tilt) * 0.8,
    ...(tilt === 0 ? {} : { slope: tilt }),
  })),
});

// Inside the polygon, by ray casting; a margin only adds to what is covered.
const inside = ({ points }: PhotoMask, x: number, y: number) => {
  let crossings = 0;
  for (let at = 0; at < points.length; at += 2) {
    const [x1 = 0, y1 = 0] = points.slice(at, at + 2);
    const [x2 = 0, y2 = 0] = points.slice((at + 2) % points.length).slice(0, 2);
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) {
      crossings += 1;
    }
  }
  return crossings % 2 === 1;
};

// Whether the middle of a row's text, and both its ends, are painted over.
const coveredAt = (masks: readonly PhotoMask[], line: RecognizedLine) => {
  const middle = line.y + line.height / 2;
  const tilt = line.slope ?? 0;
  const points = [0.05, 0.5, 0.95].map((across): [number, number] => {
    const x = line.x + line.width * across;
    return [x, middle + tilt * (x - line.x - line.width / 2)];
  });
  return points.map(([x, y]) => masks.some(mask => inside(mask, x, y)));
};

const covered = (masks: readonly PhotoMask[], line: RecognizedLine) =>
  coveredAt(masks, line).every(Boolean);

const open = (masks: readonly PhotoMask[], line: RecognizedLine) =>
  coveredAt(masks, line).every(painted => !painted);

const masksOf = (pages: RecognizedPage[]) =>
  receiptPhotoMasks(assembleReceiptRows(pages));

const lineOf = (page: RecognizedPage, text: string) => {
  const found = page.lines.find(line => line.text === text);
  if (!found) throw new Error(`No line ${text}`);
  return found;
};

const CARD_RECEIPT = [
  'SAMPLE MART',
  '100 MAIN ST  412-555-0100',
  'Cashier: Pat',
  'WHOLE MILK  3.48',
  'BREAD  2.99',
  'SUBTOTAL  6.47',
  'TOTAL  6.47',
  'VISA TEND  6.47',
  'VISA ************4242',
  'AUTH CODE 123456',
  '10/12/26 14:32',
  'REF # 987654321',
  'Card member: DOE, JANE',
  'THANK YOU',
];

describe('receiptPhotoMasks', () => {
  it('covers the payment block to the end, leaving only its date row open', () => {
    const page = pageOf(CARD_RECEIPT);
    const [masks = []] = masksOf([page]) ?? [];

    for (const text of [
      'VISA ************4242',
      'AUTH CODE 123456',
      'REF # 987654321',
      'Card member: DOE, JANE',
      'THANK YOU',
    ]) {
      expect(covered(masks, lineOf(page, text))).toBe(true);
    }
    expect(open(masks, lineOf(page, '10/12/26 14:32'))).toBe(true);
    // Below the last row, where recognition read nothing, is covered too.
    expect(masks.some(mask => inside(mask, 0.5, 0.95))).toBe(true);
  });

  it('keeps the header, the items and the totals readable', () => {
    const page = pageOf(CARD_RECEIPT);
    const [masks = []] = masksOf([page]) ?? [];

    for (const text of [
      'SAMPLE MART',
      '100 MAIN ST  412-555-0100',
      'WHOLE MILK  3.48',
      'BREAD  2.99',
      'SUBTOTAL  6.47',
      'TOTAL  6.47',
      'VISA TEND  6.47',
    ]) {
      expect(open(masks, lineOf(page, text))).toBe(true);
    }
  });

  it('covers a staff name above the items, line by line', () => {
    const page = pageOf(CARD_RECEIPT);
    const [masks = []] = masksOf([page]) ?? [];

    expect(covered(masks, lineOf(page, 'Cashier: Pat'))).toBe(true);
  });

  it("covers a member number, an email and a customer's phone above the payment block", () => {
    const page = pageOf([
      'SAMPLE MART',
      '100 MAIN ST  412-555-0100',
      'WHOLE MILK  3.48',
      'Member # 1234 5678 9012',
      'Receipt sent to pat@example.com',
      'Phone 412-555-0199',
      '2@4.99',
      'TOTAL  3.48',
      'VISA ************4242',
    ]);
    const [masks = []] = masksOf([page]) ?? [];

    for (const text of [
      'Member # 1234 5678 9012',
      'Receipt sent to pat@example.com',
      'Phone 412-555-0199',
    ]) {
      expect(covered(masks, lineOf(page, text))).toBe(true);
    }
    // The store's phone in its header, and a unit price, are no one's details.
    expect(open(masks, lineOf(page, '100 MAIN ST  412-555-0100'))).toBe(true);
    expect(open(masks, lineOf(page, '2@4.99'))).toBe(true);
  });

  it('covers a cash receipt from the row after its change', () => {
    const page = pageOf([
      'SAMPLE MART',
      'WHOLE MILK  3.48',
      'TOTAL  3.48',
      'CASH  5.00',
      'CHANGE DUE  1.52',
      'Your cashier today was Pat',
      'SURVEY CODE 7GHJ',
    ]);
    const [masks = []] = masksOf([page]) ?? [];

    expect(open(masks, lineOf(page, 'CHANGE DUE  1.52'))).toBe(true);
    expect(covered(masks, lineOf(page, 'Your cashier today was Pat'))).toBe(
      true,
    );
    expect(covered(masks, lineOf(page, 'SURVEY CODE 7GHJ'))).toBe(true);
  });

  it('covers a date row that holds a numbered field', () => {
    const page = pageOf([
      'SAMPLE MART',
      'WHOLE MILK  3.48',
      'TOTAL  3.48',
      'VISA ************4242',
      '10/12/26 14:32 Ticket # 4471',
    ]);
    const [masks = []] = masksOf([page]) ?? [];

    expect(covered(masks, lineOf(page, '10/12/26 14:32 Ticket # 4471'))).toBe(
      true,
    );
  });

  // A curled receipt: the rows near its foot tilt more than the page does.
  it('starts the block along its own row, clear of the total above it', () => {
    // Level and measured so, the page reads level; only its foot is curled.
    const level = pageOf([
      'SAMPLE MART',
      'WHOLE MILK  3.48',
      'BREAD  2.99',
      'EGGS  4.19',
      'BUTTER  3.79',
    ]).lines.map(line => ({ ...line, slope: 0 }));
    const curled = pageOf(
      ['TOTAL  14.45', 'VISA ************4242', 'THANK YOU'],
      -0.04,
    ).lines.map(line => ({ ...line, y: line.y + 0.25 }));
    const page: RecognizedPage = { lines: [...level, ...curled] };
    const [masks = []] = masksOf([page]) ?? [];

    expect(open(masks, lineOf(page, 'TOTAL  14.45'))).toBe(true);
    expect(covered(masks, lineOf(page, 'VISA ************4242'))).toBe(true);
  });

  it('starts at a card number whose digits were not read', () => {
    const page = pageOf([
      'SAMPLE MART',
      'WHOLE MILK  3.48',
      'TOTAL  3.48',
      'XXXXXXXXXXXX  H',
      'APPROVED - PURCHASE',
    ]);
    const [masks = []] = masksOf([page]) ?? [];

    expect(open(masks, lineOf(page, 'TOTAL  3.48'))).toBe(true);
    expect(covered(masks, lineOf(page, 'XXXXXXXXXXXX  H'))).toBe(true);
    expect(covered(masks, lineOf(page, 'APPROVED - PURCHASE'))).toBe(true);
  });

  it('carries the payment block onto the later pages, but for their date rows', () => {
    const first = pageOf([
      'SAMPLE MART',
      'WHOLE MILK  3.48',
      'TOTAL  3.48',
      'VISA ************4242',
    ]);
    const second = pageOf(['AUTH CODE 123456', '10/12/26 14:32', 'THANK YOU']);
    const [, masks = []] = masksOf([first, second]) ?? [];

    expect(covered(masks, lineOf(second, 'AUTH CODE 123456'))).toBe(true);
    expect(open(masks, lineOf(second, '10/12/26 14:32'))).toBe(true);
    expect(covered(masks, lineOf(second, 'THANK YOU'))).toBe(true);
  });

  it("follows a tilted page's rows, leaving the row above the block whole", () => {
    const page = pageOf(CARD_RECEIPT, 0.05);
    const [masks = []] = masksOf([page]) ?? [];

    expect(open(masks, lineOf(page, 'VISA TEND  6.47'))).toBe(true);
    expect(covered(masks, lineOf(page, 'VISA ************4242'))).toBe(true);
    expect(open(masks, lineOf(page, '10/12/26 14:32'))).toBe(true);
  });

  it('starts no block at a payment field in the header', () => {
    const page = pageOf([
      'SAMPLE MART',
      'TERMINAL # 03',
      'WHOLE MILK  3.48',
      'TOTAL  3.48',
      'CHANGE DUE  1.52',
      'THANK YOU',
    ]);
    const [masks = []] = masksOf([page]) ?? [];

    expect(covered(masks, lineOf(page, 'TERMINAL # 03'))).toBe(true);
    expect(open(masks, lineOf(page, 'WHOLE MILK  3.48'))).toBe(true);
    expect(covered(masks, lineOf(page, 'THANK YOU'))).toBe(true);
  });

  it('masks nothing when no payment block was read', () => {
    expect(
      masksOf([pageOf(['SAMPLE MART', 'WHOLE MILK  3.48', 'TOTAL  3.48'])]),
    ).toBeNull();
  });
});
