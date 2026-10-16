import type { RecognizedPage } from '#/native/TextRecognition';
import { assembleReceiptRows } from '../assembleReceiptRows';

type Row = [
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  slope?: number,
];

const page = (rows: Row[]): RecognizedPage => ({
  lines: rows.map(([text, x, y, width, height, slope]) => ({
    text,
    x,
    y,
    width,
    height,
    ...(slope === undefined ? {} : { slope }),
  })),
});

// Apple Vision's own output for a rendered two-column receipt: the left column
// first, then the price column (docs/verified-library-behaviour.md).
const VISION_OUTPUT: Row[] = [
  ['WALMART SUPERCENTER', 0.044, 0.058, 0.397, 0.035],
  ['STORE #1234 (555) 555-1234', 0.044, 0.11, 0.56, 0.032],
  ['GV WHOLE MILK 007874235186 F', 0.044, 0.213, 0.579, 0.03],
  ['BNLS SKNLS CHKN 026800000000 F', 0.044, 0.265, 0.623, 0.03],
  ['BANANAS 000000004011 KF', 0.044, 0.317, 0.477, 0.028],
  ['SUBTOTAL', 0.044, 0.418, 0.17, 0.031],
  ['TAX 1 6.000 %', 0.043, 0.465, 0.276, 0.04],
  ['TOTAL', 0.044, 0.521, 0.108, 0.03],
  ['VISA TEND', 0.044, 0.573, 0.19, 0.026],
  ['VISA ************4242', 0.044, 0.623, 0.436, 0.03],
  ['APPROVAL # 01234K', 0.044, 0.67, 0.355, 0.037],
  ['REF # 123456789012', 0.044, 0.722, 0.375, 0.037],
  ['AID A0000000031010', 0.044, 0.776, 0.375, 0.03],
  ['CHANGE DUE', 0.044, 0.828, 0.209, 0.03],
  ['# ITEMS SOLD 3', 0.039, 0.871, 0.297, 0.044],
  ['SURVEY ID 7GHJ-KL12', 0.044, 0.931, 0.394, 0.028],
  ['3.48 N', 0.832, 0.218, 0.124, 0.028],
  ['11.97 N', 0.81, 0.269, 0.144, 0.029],
  ['1.24 N', 0.832, 0.318, 0.125, 0.029],
  ['16.69', 0.852, 0.422, 0.102, 0.026],
  ['0.00', 0.871, 0.471, 0.088, 0.029],
  ['16.69', 0.852, 0.522, 0.105, 0.032],
  ['16.69', 0.852, 0.573, 0.105, 0.031],
  ['0.00', 0.873, 0.829, 0.086, 0.031],
];

// Each page's rows as text.
const rowTexts = (pages: RecognizedPage[]) =>
  assembleReceiptRows(pages).map(({ rows }) => rows.map(row => row.text));

describe('assembleReceiptRows', () => {
  it('keeps the lines each row was joined from, and the page tilt', () => {
    const [assembled] = assembleReceiptRows([page(VISION_OUTPUT)]);
    const milk = assembled?.rows[2];
    expect(milk?.text).toBe('GV WHOLE MILK 007874235186 F  3.48 N');
    expect(milk?.lines.map(line => line.text)).toEqual([
      'GV WHOLE MILK 007874235186 F',
      '3.48 N',
    ]);
    expect(assembled?.tilt).toBe(0);
  });

  it('puts each price back on its item row, in printed order', () => {
    expect(rowTexts([page(VISION_OUTPUT)])).toEqual([
      [
        'WALMART SUPERCENTER',
        'STORE #1234 (555) 555-1234',
        'GV WHOLE MILK 007874235186 F  3.48 N',
        'BNLS SKNLS CHKN 026800000000 F  11.97 N',
        'BANANAS 000000004011 KF  1.24 N',
        'SUBTOTAL  16.69',
        'TAX 1 6.000 %  0.00',
        'TOTAL  16.69',
        'VISA TEND  16.69',
        'VISA ************4242',
        'APPROVAL # 01234K',
        'REF # 123456789012',
        'AID A0000000031010',
        'CHANGE DUE  0.00',
        '# ITEMS SOLD 3',
        'SURVEY ID 7GHJ-KL12',
      ],
    ]);
  });

  // Apple Vision's reading of a hand-held Costco photo, tilted up to the right:
  // by height alone each name pairs with the price of the row below it.
  it("reads a tilted photo's rows along its slope", () => {
    const [lines] = rowTexts([
      page([
        ['12.49 E', 0.669, 0.266, 0.084, 0.032, -0.177],
        ['KS ORG A2 PR', 0.414, 0.286, 0.212, 0.052, -0.167],
        ['14.43 E', 0.672, 0.284, 0.088, 0.032, -0.177],
        ['KS CHEWY PRO', 0.419, 0.303, 0.213, 0.054, -0.17],
        ['18.43 E', 0.676, 0.303, 0.085, 0.033, -0.188],
        ['BEER BAT COD', 0.435, 0.322, 0.201, 0.051, -0.173],
        ['14.99 E', 0.68, 0.322, 0.084, 0.031, -0.171],
        ['KS BACON', 0.44, 0.347, 0.158, 0.042, -0.167],
      ]),
    ]);

    expect(lines).toEqual([
      'KS ORG A2 PR  12.49 E',
      'KS CHEWY PRO  14.43 E',
      'BEER BAT COD  18.43 E',
      'KS BACON  14.99 E',
    ]);
  });

  // A Pak'nSave photo: its long names curl to -0.026 on rows that are level.
  it("reads a level page by height, whatever its lines' curl", () => {
    const [lines] = rowTexts([
      page([
        ['Our Shopping Hours are Mon - Sun', 0.1, 0.5, 0.7, 0.03, 0],
        ['$9.84 EA =', 0.554, 0.61, 0.141, 0.0248, 0],
        ['KIWIFRUIT GREEN KG NZ', 0.125, 0.611, 0.283, 0.0296, -0.026],
        ['$9.84', 0.74, 0.612, 0.07, 0.025, -0.004],
        ['$1.87 EA =', 0.554, 0.637, 0.141, 0.0248, 0],
        ['$1.87', 0.735, 0.637, 0.076, 0.0305, 0.05],
        ['APPLES ROYAL GALA KG', 0.127, 0.639, 0.271, 0.0299, -0.026],
      ]),
    ]);

    expect(lines).toEqual([
      'Our Shopping Hours are Mon - Sun',
      'KIWIFRUIT GREEN KG NZ  $9.84 EA =  $9.84',
      'APPLES ROYAL GALA KG  $1.87 EA =  $1.87',
    ]);
  });

  // Alexander's and 99 Cents Only, as Vision read them.
  it('joins a figure split after its decimal mark, never two printed figures', () => {
    const rows = (texts: string[]): Row[] =>
      texts.map((text, index) => [text, 0.05, 0.1 + index * 0.05, 0.6, 0.03]);

    expect(
      rowTexts([
        page(
          rows([
            'CARROTS . 73',
            'PEANUTS  1  . 9999',
            'GARLIC  1 @  , 9999',
            'TOMATO  4. 94',
            '04  13.100  $1.999',
            'LIMES  2 @ 1.99',
          ]),
        ),
      ]),
    ).toEqual([
      [
        'CARROTS .73',
        'PEANUTS  1  .9999',
        'GARLIC  1 @  ,9999',
        'TOMATO  4.94',
        '04  13.100  $1.999',
        'LIMES  2 @ 1.99',
      ],
    ]);
  });

  // ML Kit on a Giant Eagle photo: every price reads half a row below its
  // name, so by height alone each would join the row after its own.
  it('moves a price column read below its names back onto their rows', () => {
    const [lines] = rowTexts([
      page([
        ['SHELLED WALNUTS 1L', 0.27, 0.527, 0.34, 0.023],
        ['4.99 F', 0.73, 0.541, 0.115, 0.014],
        ['1 PT BLUEBERRIES', 0.28, 0.543, 0.29, 0.022],
        ['3.99 F', 0.727, 0.557, 0.112, 0.014],
        ['2.45 lb @ 3.99 /lb', 0.135, 0.559, 0.34, 0.019],
        ['PEP RED PREMIUM', 0.268, 0.579, 0.281, 0.018],
        ['9.78 F', 0.736, 0.586, 0.098, 0.017],
        ['**** BALANCE', 0.166, 0.627, 0.225, 0.016],
        ['18.76', 0.702, 0.637, 0.093, 0.015],
      ]),
    ]);

    expect(lines).toEqual([
      'SHELLED WALNUTS 1L  4.99 F',
      '1 PT BLUEBERRIES  3.99 F',
      '2.45 lb @ 3.99 /lb',
      'PEP RED PREMIUM  9.78 F',
      '**** BALANCE  18.76',
    ]);
  });

  // ML Kit on an ALDI photo: the prices read a third of a row high, and a tax
  // flag read apart from its price is the first line of its row.
  it('moves a price column read above its names, tax flags with it', () => {
    const [lines] = rowTexts([
      page([
        ['12.38 FA', 0.658, 0.129, 0.116, 0.0152],
        ['Ground beef', 0.264, 0.129, 0.228, 0.0246],
        ['FA', 0.752, 0.1665, 0.022, 0.0129],
        ['1.65', 0.673, 0.1677, 0.048, 0.0141],
        ['Celery', 0.263, 0.1736, 0.077, 0.0129],
        ['0.81 FA', 0.673, 0.185, 0.105, 0.0152],
        ['Kidney beans', 0.263, 0.19, 0.194, 0.0164],
        ['15.83', 0.664, 0.243, 0.064, 0.0152],
        ['SUBTOTAL', 0.248, 0.247, 0.103, 0.0164],
      ]),
    ]);

    expect(lines).toEqual([
      'Ground beef  12.38 FA',
      'Celery  1.65  FA',
      'Kidney beans  0.81 FA',
      'SUBTOTAL  15.83',
    ]);
  });

  // ML Kit on a scanned Giant Eagle receipt, its names made up: the prices sit
  // a little above their names on evenly spaced rows, where the column moved a
  // whole row down agrees as well, every price beside the name above its own.
  it('keeps a price column off by a little on its own rows, never a row away', () => {
    const [lines] = rowTexts([
      page([
        ['ITEM A', 0.3065, 0.3819, 0.2921, 0.0126, -0.0075],
        ['1.99 F', 0.78, 0.392, 0.1146, 0.0123, -0.0144],
        ['ITEM B', 0.3058, 0.3947, 0.2542, 0.0137, -0.0108],
        ['2.99 F', 0.78, 0.4062, 0.1138, 0.012, -0.0072],
        ['ITEM C', 0.3187, 0.407, 0.3384, 0.0156, -0.0073],
        ['ITEM D', 0.1844, 0.4237, 0.1366, 0.015, -0.0121],
        ['3.99 F', 0.7792, 0.4346, 0.1138, 0.0131, -0.0169],
        ['ITEM E', 0.3065, 0.437, 0.3505, 0.0142, -0.0094],
        ['4.99 F', 0.78, 0.4488, 0.1123, 0.0112, -0.0073],
        ['ITEM F', 0.3126, 0.4499, 0.2663, 0.0161, -0.0082],
        ['5.99 F', 0.78, 0.4624, 0.1115, 0.0112, -0.0049],
        ['ITEM G', 0.3065, 0.4635, 0.2921, 0.0148, -0.0103],
        ['6.99 F', 0.7785, 0.4758, 0.1108, 0.0117, -0.0124],
        ['ITEM H', 0.3073, 0.478, 0.3483, 0.0139, -0.0094],
        ['ITEM I', 0.1692, 0.4928, 0.154, 0.0148, -0.0143],
        ['7.99 F', 0.7785, 0.5029, 0.1123, 0.012, -0.0147],
        ['ITEM J', 0.3065, 0.5037, 0.3475, 0.0175, -0.011],
        ['8.99 F', 0.7785, 0.5152, 0.1115, 0.0123, -0.0173],
        ['ITEM K', 0.3058, 0.5182, 0.3308, 0.0137, -0.0108],
        ['9.99 F', 0.7792, 0.528, 0.1131, 0.0139, -0.0245],
        ['ITEM L', 0.305, 0.5313, 0.3505, 0.0139, -0.0086],
        ['ITEM M', 0.1646, 0.5479, 0.1958, 0.0128, -0.0098],
        ['10.99 F', 0.7807, 0.5556, 0.1138, 0.0134, -0.0193],
        ['ITEM N', 0.3035, 0.5591, 0.2951, 0.0145, -0.0121],
        ['ITEM O', 0.1639, 0.5769, 0.1563, 0.0139, -0.0176],
        ['ITEM P', 0.3042, 0.584, 0.5918, 0.0178, -0.0116],
        ['ITEM Q', 0.1646, 0.6045, 0.1563, 0.0128, -0.014],
        ['11.99 F', 0.7807, 0.6116, 0.1138, 0.0126, -0.0169],
        ['ITEM R', 0.3042, 0.6129, 0.3536, 0.0178, -0.0132],
        ['12.99 F', 0.7815, 0.6261, 0.1131, 0.0117, -0.0097],
      ]),
    ]);

    expect(lines).toEqual([
      'ITEM A',
      'ITEM B  1.99 F',
      'ITEM C  2.99 F',
      'ITEM D',
      'ITEM E  3.99 F',
      'ITEM F  4.99 F',
      'ITEM G  5.99 F',
      'ITEM H  6.99 F',
      'ITEM I',
      'ITEM J  7.99 F',
      'ITEM K  8.99 F',
      'ITEM L  9.99 F',
      'ITEM M',
      'ITEM N  10.99 F',
      'ITEM O',
      'ITEM P',
      'ITEM Q',
      'ITEM R  11.99 F',
      '12.99 F',
    ]);
  });

  it('reads a page by height alone where too few prices agree on an offset', () => {
    const [lines] = rowTexts([
      page([
        ['COFFEE', 0.1, 0.2, 0.3, 0.03],
        ['5.99', 0.75, 0.21, 0.08, 0.03],
        ['TEA', 0.1, 0.26, 0.2, 0.03],
        ['3.49', 0.75, 0.27, 0.08, 0.03],
      ]),
    ]);

    expect(lines).toEqual(['COFFEE  5.99', 'TEA  3.49']);
  });

  it('keeps pages apart and in scan order, and drops blank lines', () => {
    const first = page([['MILK', 0.1, 0.1, 0.3, 0.03]]);
    const second = page([
      ['   ', 0.1, 0.05, 0.3, 0.03],
      ['EGGS', 0.1, 0.1, 0.3, 0.03],
    ]);

    expect(rowTexts([first, second])).toEqual([['MILK'], ['EGGS']]);
  });

  // Apple Vision's reading of photographed Giant Eagle and ALDI UK receipts.
  it('maps Cyrillic twins back and drops noise after a figure on a Latin page', () => {
    const rows = (texts: string[]): Row[] =>
      texts.map((text, index) => [text, 0.05, 0.1 + index * 0.05, 0.5, 0.03]);

    expect(
      rowTexts([
        page(
          rows([
            'BK PIE 4 -PEACH  АC  1.50 F',
            'TAХ  0.12',
            '**** BALANCE  154.7îźś',
            'HAW PUNCH 6P (.95)  3.04-ÍŘ',
            '807344 MANGO LOOSE  0.69 Aę',
            'CAFÉ AU LAIT  2.99',
          ]),
        ),
      ]),
    ).toEqual([
      [
        'BK PIE 4 -PEACH  AC  1.50 F',
        'TAX  0.12',
        '**** BALANCE  154.7',
        'HAW PUNCH 6P (.95)  3.04-',
        '807344 MANGO LOOSE  0.69 A',
        'CAFÉ AU LAIT  2.99',
      ],
    ]);
  });

  it('reads back a dollar sign read as an 8 on a page printing dollars', () => {
    const [dollars, plain] = rowTexts([
      page([
        ['CREAM CHEESE BAR  $1.75  F', 0.05, 0.1, 0.9, 0.03],
        ['CREAM CHEESE BAR  81.75  F', 0.05, 0.15, 0.9, 0.03],
        ['HOAGIE ROLLS  $3.25  F', 0.05, 0.2, 0.9, 0.03],
        ['SUBTOTAL  $6.75', 0.05, 0.25, 0.9, 0.03],
      ]),
      page([
        ['MILK  3.48', 0.05, 0.1, 0.9, 0.03],
        ['STEAK  81.75', 0.05, 0.15, 0.9, 0.03],
        ['SUBTOTAL  85.23', 0.05, 0.2, 0.9, 0.03],
      ]),
    ]);

    expect(dollars?.[1]).toBe('CREAM CHEESE BAR  $1.75  F');
    expect(plain?.[1]).toBe('STEAK  81.75');
  });

  it('leaves a page printed in Cyrillic as read', () => {
    const cyrillic = page([['МОЛОКО 3,2%  89.90 А', 0.05, 0.1, 0.5, 0.03]]);

    expect(rowTexts([cyrillic])).toEqual([['МОЛОКО 3,2%  89.90 А']]);
  });
});
