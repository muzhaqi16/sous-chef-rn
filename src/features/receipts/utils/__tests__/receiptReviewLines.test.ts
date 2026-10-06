import { receiptReviewLines } from '../receiptReviewLines';
import { parsedReceipt } from '../../__tests__/helpers/receiptFixtures';

describe('receiptReviewLines', () => {
  it('lists only the item lines, keeping their printed figures', () => {
    const receipt = parsedReceipt(
      [
        { rawText: 'KROGER', kind: 'other' },
        {
          rawText: 'BANANAS',
          kind: 'item',
          product: 'BANANAS',
          quantity: 2.14,
          unit: 'lb',
          unitPrice: 0.59,
          lineTotal: 1.26,
        },
        { rawText: 'TAX 0.00', kind: 'tax', lineTotal: 0 },
        { rawText: 'BALANCE 1.26', kind: 'total', lineTotal: 1.26 },
      ],
      'KROGER',
    );

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 1, printed: 'BANANAS', quantity: 2.14, unit: 'lb', price: 1.26 },
    ]);
  });

  it('takes each discount off the item it names, however it is printed', () => {
    const receipt = parsedReceipt([
      {
        rawText: 'KRO WHL MILK 3.29',
        kind: 'item',
        product: 'KRO WHL MILK',
        lineTotal: 3.29,
      },
      {
        rawText: 'SC KROGER SAVINGS 0.50-',
        kind: 'discount',
        lineTotal: -0.5,
        appliesToIndex: 0,
      },
      {
        rawText: 'COUPON 0.30',
        kind: 'discount',
        lineTotal: 0.3,
        appliesToIndex: 0,
      },
      {
        rawText: 'BREAD WHT 3.98',
        kind: 'item',
        product: 'BREAD WHT',
        lineTotal: 3.98,
      },
    ]);

    expect(receiptReviewLines(receipt).map(line => line.price)).toEqual([
      2.49, 3.98,
    ]);
  });

  it('never prices a line below zero, and leaves an unpriced line unpriced', () => {
    const receipt = parsedReceipt([
      { rawText: 'FREE SAMPLE 1.00', kind: 'item', lineTotal: 1 },
      {
        rawText: 'COUPON 2.00-',
        kind: 'discount',
        lineTotal: -2,
        appliesToIndex: 0,
      },
      { rawText: 'EGGS', kind: 'item', product: 'EGGS' },
    ]);

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 0, printed: 'FREE SAMPLE 1.00', price: 0 },
      { index: 2, printed: 'EGGS' },
    ]);
  });
});
