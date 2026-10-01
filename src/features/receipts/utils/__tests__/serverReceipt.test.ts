import { ReceiptLineKind } from '#/graphql/generated/schemaTypes';
import { fromServerReceipt } from '../serverReceipt';
import { receiptReviewLines } from '../receiptReviewLines';
import { receiptTotalsGap } from '../receiptTotalsGap';

describe('fromServerReceipt', () => {
  const receipt = {
    merchant: { name: ' KROGER ' },
    lines: [
      { text: 'KROGER #412', kind: ReceiptLineKind.Other },
      {
        text: 'KRO WHL MILK 3.29 F',
        kind: ReceiptLineKind.Item,
        product: 'KRO WHL MILK',
        code: '0001111041700',
        amount: 3.29,
      },
      {
        text: 'SC KROGER SAVINGS 0.50-',
        kind: ReceiptLineKind.Discount,
        amount: -0.5,
        appliesTo: 1,
      },
      {
        text: 'BANANAS 2.14 lb @ 0.59 /lb 1.26',
        kind: ReceiptLineKind.Item,
        product: 'BANANAS',
        quantity: 2.14,
        unit: 'lb',
        unitPrice: 0.59,
        amount: 1.26,
      },
      {
        text: 'BOTTLE DEPOSIT 0.10',
        kind: ReceiptLineKind.Deposit,
        amount: 0.1,
      },
      { text: 'SUBTOTAL 4.15', kind: ReceiptLineKind.Subtotal, amount: 4.15 },
      { text: 'TAX 0.00', kind: ReceiptLineKind.Tax, amount: 0 },
      { text: 'VISA 4.15', kind: ReceiptLineKind.Payment, amount: 4.15 },
    ],
  };

  it('reads as the review reads a receipt the phone structured', () => {
    const parsed = fromServerReceipt(receipt);

    expect(parsed.merchant).toBe('KROGER');
    expect(parsed.lines[2]).toEqual({
      index: 2,
      rawText: 'SC KROGER SAVINGS 0.50-',
      kind: 'discount',
      lineTotal: -0.5,
      appliesToIndex: 1,
    });
    expect(receiptReviewLines(parsed)).toEqual([
      { index: 1, printed: 'KRO WHL MILK', code: '0001111041700', price: 2.79 },
      {
        index: 3,
        printed: 'BANANAS',
        quantity: 2.14,
        unit: 'lb',
        price: 1.26,
      },
    ]);
  });

  it('counts a deposit toward the subtotal, as a fee', () => {
    expect(receiptTotalsGap(fromServerReceipt(receipt))).toBeNull();
  });

  it('folds a weight line the server returned as an item into the item above', () => {
    const parsed = fromServerReceipt({
      merchant: { name: 'WALMART' },
      lines: [
        {
          text: 'BANANAS 000000040110KF 1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          code: '000000040110',
          amount: 1.02,
        },
        { text: '2.21 lb @ 1 lb /0.46', kind: ReceiptLineKind.Item },
        // An item whose price the server missed stays an item.
        {
          text: 'PRG CHED SC 038000138970',
          kind: ReceiptLineKind.Item,
          product: 'PRG CHED SC',
          code: '038000138970',
        },
      ],
    });

    expect(parsed.lines[1]).toEqual({
      index: 1,
      rawText: '2.21 lb @ 1 lb /0.46',
      kind: 'other',
      appliesToIndex: 0,
    });
    expect(receiptReviewLines(parsed)).toEqual([
      {
        index: 0,
        printed: 'BANANAS',
        code: '000000040110',
        quantity: 2.21,
        unit: 'lb',
        price: 1.02,
      },
      { index: 2, printed: 'PRG CHED SC', code: '038000138970' },
    ]);
  });

  it('leaves out a merchant the server could not name', () => {
    expect(fromServerReceipt({ merchant: { name: null }, lines: [] })).toEqual({
      lines: [],
    });
  });
});
