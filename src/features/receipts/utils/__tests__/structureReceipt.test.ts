import type { ReceiptLineLabels } from '#/native/ReceiptStructuring';
import {
  isUsableReceipt,
  linesThroughTotal,
  structureReceipt,
} from '../structureReceipt';

// Receipt lines and the labels Foundation Models returned for them in the app
// on the iOS simulator (docs/verified-library-behaviour.md).
const WALMART = [
  'WALMART SUPERCENTER',
  'STORE #1234 (555) 555-1234',
  'GV WHOLE MILK 007874235186 F  3.48 N',
  'BNLS SKNLS CHKN 026800000000 F  11.97 N',
  'BANANAS 000000004011 KF  1.24 N',
  'SUBTOTAL  16.69',
  'TAX 1 6.000 %  0.00',
  'TOTAL  16.69',
  'VISA TEND  16.69',
  'CHANGE DUE  0.00',
];
const WALMART_LABELS: ReceiptLineLabels = {
  storeName: 'WALMART SUPERCENTER',
  lines: [
    { line: 0, label: 'header', product: 'WALMART SUPERCENTER' },
    { line: 1, label: 'header', product: 'STORE #1234 (555) 555-1234' },
    { line: 2, label: 'item', product: 'GV WHOLE MILK' },
    { line: 3, label: 'item', product: 'BNLS SKNLS CHKN' },
    { line: 4, label: 'item', product: 'BANANAS' },
    { line: 5, label: 'subtotal', product: 'SUBTOTAL' },
    { line: 6, label: 'tax', product: 'TAX' },
    { line: 7, label: 'total', product: 'TOTAL' },
    { line: 8, label: 'payment', product: 'VISA TEND' },
    { line: 9, label: 'other', product: 'CHANGE DUE' },
  ],
};

const KROGER = [
  'KROGER',
  '0001111041700 KRO WHL MILK  3.29 F',
  'SC KROGER SAVINGS  0.50-',
  '2 @ 1.99',
  '0007874201122 BREAD WHT  3.98 F',
  'BANANAS',
  '2.14 lb @ 0.59 /lb',
  'WT  1.26 F',
  'TAX  0.00',
  '**** BALANCE  7.03',
];
const KROGER_LABELS: ReceiptLineLabels = {
  storeName: 'KROGER',
  lines: [
    { line: 0, label: 'header' },
    { line: 1, label: 'item', product: 'KRO WHL MILK' },
    { line: 2, label: 'discount', product: 'SC KROGER SAVINGS' },
    { line: 3, label: 'itemDetail', product: '2 @ 1.99' },
    { line: 4, label: 'item', product: 'BREAD WHT' },
    { line: 5, label: 'item', product: 'BANANAS' },
    { line: 6, label: 'itemDetail', product: '2.14 lb @ 0.59 /lb' },
    { line: 7, label: 'itemDetail', product: 'WT  1.26 F' },
    { line: 8, label: 'tax' },
    { line: 9, label: 'total', product: '**** BALANCE' },
  ],
};

const COSTCO = [
  'COSTCO WHOLESALE',
  'E 1234567 KS WATER 40PK  4.99 A',
  'E 987654 ORG EGGS 24CT  7.49',
  '/ 987654 TPD/EGGS  1.50-',
  'E 55501 BNLS THIGHS  17.99',
  'SUBTOTAL  28.97',
  'TAX  0.36',
  '**** TOTAL  29.33',
  'VISA  29.33',
  'CHANGE  0.00',
];
const COSTCO_LABELS: ReceiptLineLabels = {
  storeName: 'COSTCO WHOLESALE',
  lines: [
    { line: 0, label: 'header', product: 'COSTCO WHOLESALE' },
    { line: 1, label: 'item', product: 'E 1234567 KS WATER 40PK' },
    { line: 2, label: 'item', product: 'E 987654 ORG EGGS 24CT' },
    { line: 3, label: 'itemDetail', product: 'TPD/EGGS' },
    { line: 4, label: 'item', product: '55501 BNLS THIGHS' },
    { line: 5, label: 'subtotal' },
    { line: 6, label: 'tax' },
    { line: 7, label: 'total' },
    { line: 8, label: 'payment' },
    { line: 9, label: 'payment' },
  ],
};

const items = (lines: readonly string[], labels: ReceiptLineLabels) =>
  structureReceipt(lines, labels).lines.filter(line => line.kind === 'item');

describe('structureReceipt', () => {
  it('Walmart: items carry the printed price and code, never the model’s figures', () => {
    const parsed = structureReceipt(WALMART, WALMART_LABELS);

    expect(parsed.merchant).toBe('WALMART SUPERCENTER');
    expect(items(WALMART, WALMART_LABELS)).toEqual([
      {
        index: 2,
        rawText: WALMART[2],
        kind: 'item',
        product: 'GV WHOLE MILK',
        code: '007874235186',
        lineTotal: 3.48,
      },
      {
        index: 3,
        rawText: WALMART[3],
        kind: 'item',
        product: 'BNLS SKNLS CHKN',
        code: '026800000000',
        lineTotal: 11.97,
      },
      {
        index: 4,
        rawText: WALMART[4],
        kind: 'item',
        product: 'BANANAS',
        code: '000000004011',
        lineTotal: 1.24,
      },
    ]);
    expect(parsed.lines.map(line => line.kind)).toEqual([
      'other',
      'other',
      'item',
      'item',
      'item',
      'subtotal',
      'tax',
      'total',
      'payment',
      'other',
    ]);
  });

  it('Kroger: a count line joins the item it multiplies to, a weight the item above it', () => {
    const parsed = structureReceipt(KROGER, KROGER_LABELS);
    const byIndex = new Map(parsed.lines.map(line => [line.index, line]));

    expect(byIndex.get(4)).toMatchObject({
      product: 'BREAD WHT',
      quantity: 2,
      unitPrice: 1.99,
      lineTotal: 3.98,
    });
    expect(byIndex.get(3)).toMatchObject({ kind: 'other', appliesToIndex: 4 });
    expect(byIndex.get(5)).toMatchObject({
      product: 'BANANAS',
      quantity: 2.14,
      unit: 'lb',
      unitPrice: 0.59,
      lineTotal: 1.26,
    });
    expect(byIndex.get(7)).toMatchObject({ appliesToIndex: 5 });
    expect(byIndex.get(7)?.lineTotal).toBeUndefined();
    expect(byIndex.get(2)).toMatchObject({
      kind: 'discount',
      lineTotal: -0.5,
      appliesToIndex: 1,
    });
    expect(byIndex.get(9)).toMatchObject({ kind: 'total', lineTotal: 7.03 });
  });

  it('Costco: an instant saving is a discount on the item with its number, and flags leave the name', () => {
    const parsed = structureReceipt(COSTCO, COSTCO_LABELS);
    const byIndex = new Map(parsed.lines.map(line => [line.index, line]));

    expect(items(COSTCO, COSTCO_LABELS).map(line => line.product)).toEqual([
      'KS WATER 40PK',
      'ORG EGGS 24CT',
      'BNLS THIGHS',
    ]);
    expect(byIndex.get(3)).toMatchObject({
      kind: 'discount',
      lineTotal: -1.5,
      appliesToIndex: 2,
    });
  });

  // Shapes from the photographed corpus (__tests__/fixtures/receipts/corpus).
  it('follows each label to the line its product words were copied from', () => {
    // A Walmart photo: the model skipped two lines and numbered the rest from 0.
    const drifted: ReceiptLineLabels = {
      lines: WALMART_LABELS.lines
        .slice(2)
        .map(label => ({ ...label, line: label.line - 2 })),
    };

    expect(
      items(WALMART, drifted).map(line => [
        line.index,
        line.product,
        line.lineTotal,
      ]),
    ).toEqual([
      [2, 'GV WHOLE MILK', 3.48],
      [3, 'BNLS SKNLS CHKN', 11.97],
      [4, 'BANANAS', 1.24],
    ]);
  });

  it('ALDI US: a priced product line the model called a detail is an item', () => {
    const lines = [
      'ALDI',
      'Org Grnd Beef  12.38  FA',
      '6.19',
      'Kidney Beans  0.81  FA',
      'SUBTOTAL  13.19',
    ];
    const parsed = structureReceipt(lines, {
      lines: [
        { line: 0, label: 'header' },
        { line: 1, label: 'itemDetail', product: 'Org Grnd Beef' },
        { line: 2, label: 'item' },
        { line: 3, label: 'itemDetail', product: 'Kidney Beans' },
        { line: 4, label: 'subtotal' },
      ],
    });

    expect(
      parsed.lines
        .filter(line => line.kind === 'item')
        .map(line => [line.product, line.lineTotal]),
    ).toEqual([
      ['Org Grnd Beef', 12.38],
      ['Kidney Beans', 0.81],
    ]);
    // The unit price alone on its row describes the beef; it is not a fee.
    expect(parsed.lines[2]).toMatchObject({ kind: 'other', appliesToIndex: 1 });
    expect(parsed.lines[2]?.lineTotal).toBeUndefined();
  });

  it('ALDI UK: a count the model called a discount takes nothing off', () => {
    const parsed = structureReceipt(
      [
        '701185 CHICKEN FILLETS  4.49',
        '2 x  2.19',
        '13317 BUTTER 250G  4.38 A',
      ],
      {
        lines: [
          { line: 0, label: 'item', product: 'CHICKEN FILLETS' },
          { line: 1, label: 'discount' },
          { line: 2, label: 'item', product: 'BUTTER 250G' },
        ],
      },
    );

    expect(parsed.lines.some(line => line.kind === 'discount')).toBe(false);
    expect(parsed.lines[2]).toMatchObject({
      product: 'BUTTER 250G',
      quantity: 2,
      unitPrice: 2.19,
      lineTotal: 4.38,
    });
  });

  it('prices an item from a price read on the row above it (a skewed photo)', () => {
    const parsed = structureReceipt(
      ['ALDI STORES', '1.15 A', '740418 CHUTNEY'],
      {
        lines: [
          { line: 0, label: 'header' },
          { line: 1, label: 'item' },
          { line: 2, label: 'item', product: 'CHUTNEY' },
        ],
      },
    );

    expect(parsed.lines[2]).toMatchObject({ kind: 'item', lineTotal: 1.15 });
    expect(parsed.lines[1]).toMatchObject({ kind: 'other', appliesToIndex: 2 });
  });

  it('keeps every code at the line end out of the product words', () => {
    const [line] = items(
      ['SH FN 2CT BK 071641180510  888849007170 F  6.96 Y'],
      {
        lines: [
          {
            line: 0,
            label: 'item',
            product: 'SH FN 2CT BK 071641180510 888849007170 F 6.96 Y',
          },
        ],
      },
    );

    expect(line).toMatchObject({ product: 'SH FN 2CT BK', lineTotal: 6.96 });
  });

  it('keeps the price, and the flag after the code, out of the product words', () => {
    const [line] = items(['SBX PPR GR 7 762111466790 F  4.28 R'], {
      lines: [
        {
          line: 0,
          label: 'item',
          product: 'SBX PPR GR 7 762111466790 F 4.28 R',
        },
      ],
    });

    expect(line).toMatchObject({
      product: 'SBX PPR GR 7',
      code: '762111466790',
      lineTotal: 4.28,
    });
  });

  it('a skewed photo: the total and tax take the price beside them, a weight line stays with its item', () => {
    // The model's own numbering, as it labelled this photo in the app: it
    // skipped the lines with no words and gave the weight line its item's name.
    const lines = [
      'WALMART',
      '4.72 Y',
      'HUMMUS W/RO  040822017510 F',
      'BANANAS  000000040110KF  1.02 R',
      '2.21 lb. @ 1lb.  /0.46',
      'F',
      '5.74',
      'SUBTOTAL',
      '0.38',
      'TAX2  6.9750 %',
      'TOTAL  6.12',
    ];
    const parsed = structureReceipt(lines, {
      lines: [
        { line: 0, label: 'header', product: 'WALMART' },
        { line: 1, label: 'item', product: 'HUMMUS W/RO' },
        { line: 2, label: 'item', product: 'BANANAS' },
        { line: 3, label: 'itemDetail', product: 'BANANAS' },
        { line: 4, label: 'subtotal', product: 'SUBTOTAL' },
        { line: 5, label: 'tax', product: 'TAX2' },
        { line: 6, label: 'total', product: 'TOTAL' },
      ],
    });
    const byIndex = new Map(parsed.lines.map(line => [line.index, line]));

    expect(byIndex.get(2)).toMatchObject({ kind: 'item', lineTotal: 4.72 });
    expect(byIndex.get(3)).toMatchObject({
      kind: 'item',
      product: 'BANANAS',
      lineTotal: 1.02,
    });
    expect(byIndex.get(4)).toMatchObject({ appliesToIndex: 3 });
    expect(byIndex.get(7)).toMatchObject({ kind: 'subtotal', lineTotal: 5.74 });
    expect(byIndex.get(9)).toMatchObject({ kind: 'tax', lineTotal: 0.38 });
    expect(byIndex.get(6)?.lineTotal).toBeUndefined();
  });

  it('lets the printed words overrule a wrong label', () => {
    const parsed = structureReceipt(['MILK  3.48', 'SUBTOTAL  3.48'], {
      lines: [
        { line: 0, label: 'item', product: 'MILK' },
        { line: 1, label: 'item', product: 'SUBTOTAL' },
      ],
    });

    expect(parsed.lines.map(line => line.kind)).toEqual(['item', 'subtotal']);
  });
});

describe('linesThroughTotal', () => {
  it('stops at the first printed total, leaving the tender and footer out', () => {
    expect(
      linesThroughTotal([
        'ALDI',
        'Celery  1.65  FA',
        'SUBTOTAL  15.83',
        'AMOUNT DUE  16.19',
        'Debit Card  16.19',
        'Enter the drawing for a chance',
        'Must be 18 years old to enter.',
      ]),
    ).toEqual([
      'ALDI',
      'Celery  1.65  FA',
      'SUBTOTAL  15.83',
      'AMOUNT DUE  16.19',
    ]);
  });

  it('passes over a store name or total with no amount', () => {
    const lines = ['TOTAL WINE & MORE', 'MERLOT  9.99', 'TOTAL ITEMS 1'];

    expect(linesThroughTotal(lines)).toEqual(lines);
  });
});

describe('isUsableReceipt', () => {
  it('keeps a receipt the model placed and that has a priced item', () => {
    expect(
      isUsableReceipt(
        structureReceipt(WALMART, WALMART_LABELS),
        WALMART_LABELS,
      ),
    ).toBe(true);
  });

  it('keeps one where the model skipped a few wordless lines', () => {
    const skippedTwo: ReceiptLineLabels = {
      lines: WALMART_LABELS.lines.filter(
        label => label.line !== 6 && label.line !== 9,
      ),
    };

    expect(
      isUsableReceipt(structureReceipt(WALMART, skippedTwo), skippedTwo),
    ).toBe(true);
  });

  it('drops one where the model skipped lines, or no item has a price', () => {
    const skipped: ReceiptLineLabels = {
      lines: WALMART_LABELS.lines.slice(0, 5),
    };
    expect(isUsableReceipt(structureReceipt(WALMART, skipped), skipped)).toBe(
      false,
    );

    const noPrices: ReceiptLineLabels = {
      lines: [{ line: 0, label: 'item', product: 'BANANAS' }],
    };
    expect(
      isUsableReceipt(structureReceipt(['BANANAS'], noPrices), noPrices),
    ).toBe(false);
  });
});
