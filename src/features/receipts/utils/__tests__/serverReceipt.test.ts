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

  it('leaves out a merchant the server could not name', () => {
    expect(fromServerReceipt({ merchant: { name: null }, lines: [] })).toEqual({
      lines: [],
    });
  });
});
