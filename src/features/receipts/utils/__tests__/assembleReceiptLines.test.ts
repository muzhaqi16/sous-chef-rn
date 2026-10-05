import type { RecognizedPage } from '#/native/TextRecognition';
import { assembleReceiptLines } from '../assembleReceiptLines';

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

describe('assembleReceiptLines', () => {
  it('puts each price back on its item row, in printed order', () => {
    expect(assembleReceiptLines([page(VISION_OUTPUT)])).toEqual([
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
    const [lines] = assembleReceiptLines([
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
    const [lines] = assembleReceiptLines([
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

  it('keeps pages apart and in scan order, and drops blank lines', () => {
    const first = page([['MILK', 0.1, 0.1, 0.3, 0.03]]);
    const second = page([
      ['   ', 0.1, 0.05, 0.3, 0.03],
      ['EGGS', 0.1, 0.1, 0.3, 0.03],
    ]);

    expect(assembleReceiptLines([first, second])).toEqual([['MILK'], ['EGGS']]);
  });

  // Apple Vision's reading of photographed Giant Eagle and ALDI UK receipts.
  it('maps Cyrillic twins back and drops noise after a figure on a Latin page', () => {
    const rows = (texts: string[]): Row[] =>
      texts.map((text, index) => [text, 0.05, 0.1 + index * 0.05, 0.5, 0.03]);

    expect(
      assembleReceiptLines([
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
    const [dollars, plain] = assembleReceiptLines([
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

    expect(assembleReceiptLines([cyrillic])).toEqual([
      ['МОЛОКО 3,2%  89.90 А'],
    ]);
  });
});
