import { orderDiscountOf, receiptReviewLines } from '../receiptReviewLines';
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
      { index: 0, printed: 'FREE SAMPLE 1.00', price: 0, discount: 1 },
      { index: 2, printed: 'EGGS' },
    ]);
  });

  it('keeps what a coupon took off beside the price paid', () => {
    const receipt = parsedReceipt([
      {
        rawText: 'MAYONNAISE AC 7.49 F',
        kind: 'item',
        product: 'MAYONNAISE AC',
        lineTotal: 7.49,
      },
      {
        rawText: 'SC 6013 MAYONNAISE (6.49) 1.00-F',
        kind: 'discount',
        lineTotal: -1,
        appliesToIndex: 0,
      },
    ]);

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 0, printed: 'MAYONNAISE AC', price: 6.49, discount: 1 },
    ]);
  });

  it('adds up two discounts on one line', () => {
    const receipt = parsedReceipt([
      { rawText: 'MILK 3.29', kind: 'item', product: 'MILK', lineTotal: 3.29 },
      {
        rawText: 'SAVINGS 0.50-',
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
    ]);

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 0, printed: 'MILK', price: 2.49, discount: 0.8 },
    ]);
  });

  it('puts a discount that names no line on none of them', () => {
    const receipt = parsedReceipt([
      { rawText: 'MILK 3.29', kind: 'item', product: 'MILK', lineTotal: 3.29 },
      { rawText: '$5 OFF $50 5.00-', kind: 'discount', lineTotal: -5 },
    ]);

    expect(receiptReviewLines(receipt)).toEqual([
      { index: 0, printed: 'MILK', price: 3.29 },
    ]);
  });
});

describe('orderDiscountOf', () => {
  it('counts a saving on the whole order printed before the total', () => {
    const receipt = parsedReceipt([
      { rawText: 'MILK 30.00', kind: 'item', lineTotal: 30 },
      { rawText: 'EGGS 25.00', kind: 'item', lineTotal: 25 },
      { rawText: '$5 OFF $50 5.00-', kind: 'discount', lineTotal: -5 },
      { rawText: 'BALANCE 50.00', kind: 'total', lineTotal: 50 },
    ]);

    expect(orderDiscountOf(receipt)).toBe(5);
  });

  it('never counts a line discount or a savings summary after the payment', () => {
    const receipt = parsedReceipt([
      { rawText: 'MAYONNAISE 7.49', kind: 'item', lineTotal: 7.49 },
      {
        rawText: 'SC MAYO 1.00-',
        kind: 'discount',
        lineTotal: -1,
        appliesToIndex: 0,
      },
      { rawText: 'BALANCE 6.49', kind: 'total', lineTotal: 6.49 },
      { rawText: 'TOTAL SAVINGS TODAY 1.00', kind: 'discount', lineTotal: 1 },
    ]);

    expect(orderDiscountOf(receipt)).toBe(0);
  });
});
