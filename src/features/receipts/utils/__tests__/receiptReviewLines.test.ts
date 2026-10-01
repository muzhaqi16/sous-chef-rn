import type { ParsedReceipt } from '../structureReceipt';
import { receiptReviewLines } from '../receiptReviewLines';

describe('receiptReviewLines', () => {
  it('lists only the item lines, keeping their printed figures', () => {
    const receipt: ParsedReceipt = {
      merchant: 'KROGER',
      lines: [
        { index: 0, rawText: 'KROGER', kind: 'other' },
        {
          index: 1,
          rawText: 'BANANAS',
          kind: 'item',
          product: 'BANANAS',
          quantity: 2.14,
          unit: 'lb',
          unitPrice: 0.59,
          lineTotal: 1.26,
        },
        { index: 2, rawText: 'TAX 0.00', kind: 'tax', lineTotal: 0 },
        { index: 3, rawText: 'BALANCE 1.26', kind: 'total', lineTotal: 1.26 },
      ],
    };

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 1, printed: 'BANANAS', quantity: 2.14, unit: 'lb', price: 1.26 },
    ]);
  });

  it('takes each discount off the item it names, however it is printed', () => {
    const receipt: ParsedReceipt = {
      lines: [
        {
          index: 0,
          rawText: 'KRO WHL MILK 3.29',
          kind: 'item',
          product: 'KRO WHL MILK',
          lineTotal: 3.29,
        },
        {
          index: 1,
          rawText: 'SC KROGER SAVINGS 0.50-',
          kind: 'discount',
          lineTotal: -0.5,
          appliesToIndex: 0,
        },
        {
          index: 2,
          rawText: 'COUPON 0.30',
          kind: 'discount',
          lineTotal: 0.3,
          appliesToIndex: 0,
        },
        {
          index: 3,
          rawText: 'BREAD WHT 3.98',
          kind: 'item',
          product: 'BREAD WHT',
          lineTotal: 3.98,
        },
      ],
    };

    expect(receiptReviewLines(receipt).map(line => line.price)).toEqual([
      2.49, 3.98,
    ]);
  });

  it('never prices a line below zero, and leaves an unpriced line unpriced', () => {
    const receipt: ParsedReceipt = {
      lines: [
        { index: 0, rawText: 'FREE SAMPLE 1.00', kind: 'item', lineTotal: 1 },
        {
          index: 1,
          rawText: 'COUPON 2.00-',
          kind: 'discount',
          lineTotal: -2,
          appliesToIndex: 0,
        },
        { index: 2, rawText: 'EGGS', kind: 'item', product: 'EGGS' },
      ],
    };

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 0, printed: 'FREE SAMPLE 1.00', price: 0 },
      { index: 2, printed: 'EGGS' },
    ]);
  });
});
