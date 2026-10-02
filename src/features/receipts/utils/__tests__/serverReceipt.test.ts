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

  // As the dev parser answered for a photographed Walmart receipt (corpus:
  // walmart-food-receipt-8-sep-2021).
  it("takes the figures the line prints over the server's, and drops a tax flag given as a unit", () => {
    const parsed = fromServerReceipt({
      merchant: { name: 'Walmart' },
      lines: [
        {
          text: 'BANANAS  000000040110KF  1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          quantity: 1,
          unit: 'R',
          amount: 4.94,
        },
        {
          text: '2.21 lb. @ 1 1b. /0.46  4.94 Y',
          kind: ReceiptLineKind.Item,
          product: '2.21 lb. @ 1 1b. /0.46',
          amount: 4.94,
        },
        {
          text: 'DEVILED EGG 078742213510 F  4.96 R',
          kind: ReceiptLineKind.Item,
          product: 'DEVILED EGG',
          quantity: 1,
          unit: 'R',
          amount: 4.96,
        },
      ],
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
      {
        index: 2,
        printed: 'DEVILED EGG',
        code: '078742213510',
        quantity: 1,
        price: 4.96,
      },
    ]);
    expect(parsed.lines[1]).toMatchObject({ kind: 'other', appliesToIndex: 0 });
    expect(parsed.lines[1]?.lineTotal).toBeUndefined();
  });

  it('takes no pack size for a code', () => {
    const parsed = fromServerReceipt({
      merchant: {},
      lines: [
        {
          text: 'OATS 1500G  3.99',
          kind: ReceiptLineKind.Item,
          product: 'OATS',
          code: '1500G',
          amount: 3.99,
        },
      ],
    });

    expect(parsed.lines[0]?.code).toBeUndefined();
  });

  // As the dev parser answered for the same receipt read on the simulator.
  it('takes no price for a code, and no subtotal for an item price', () => {
    const parsed = fromServerReceipt({
      merchant: { name: 'Walmart' },
      lines: [
        {
          text: 'BANANAS  000000040110KF  1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          code: '000000040110KF',
          quantity: 1,
          unit: 'R',
          amount: 1.02,
        },
        {
          text: '2.21 lb. @ 1lb.  /0.46  4.94 Y',
          kind: ReceiptLineKind.Item,
          product: '2.21 lb. @ 1lb.',
          code: '4.94',
          quantity: 2.21,
          unit: 'lb.',
          amount: 4.94,
        },
        {
          text: 'DEVILED EGG  078742213510 F  4.96 R',
          kind: ReceiptLineKind.Item,
          product: 'DEVILED EGG',
          code: '078742213510',
          amount: 4.96,
        },
        {
          text: 'PRG CHED SC  038000138970',
          kind: ReceiptLineKind.Item,
          product: 'PRG CHED SC',
          code: '038000138970',
          quantity: 1,
          amount: 27.13,
        },
        { text: 'SUBTOTAL', kind: ReceiptLineKind.Subtotal, amount: 27.13 },
      ],
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
      {
        index: 2,
        printed: 'DEVILED EGG',
        code: '078742213510',
        price: 4.96,
      },
      {
        index: 3,
        printed: 'PRG CHED SC',
        code: '038000138970',
        quantity: 1,
      },
    ]);
  });

  it('keeps the price of the only item, which is the subtotal', () => {
    const parsed = fromServerReceipt({
      merchant: { name: 'Walmart' },
      lines: [
        {
          text: 'GV WHOLE MILK 007874235186 F 3.48 N',
          kind: ReceiptLineKind.Item,
          product: 'GV WHOLE MILK',
          amount: 3.48,
        },
        { text: 'SUBTOTAL 3.48', kind: ReceiptLineKind.Subtotal, amount: 3.48 },
      ],
    });

    expect(parsed.lines[0]?.lineTotal).toBe(3.48);
  });

  it('keeps an item price its own line prints, though it is the subtotal', () => {
    const parsed = fromServerReceipt({
      merchant: {},
      lines: [
        {
          text: 'COFFEE  9.99',
          kind: ReceiptLineKind.Item,
          product: 'COFFEE',
          amount: 9.99,
        },
        {
          text: 'MUG  0.00',
          kind: ReceiptLineKind.Item,
          product: 'MUG',
          amount: 0,
        },
        { text: 'SUBTOTAL 9.99', kind: ReceiptLineKind.Subtotal, amount: 9.99 },
      ],
    });

    expect(parsed.lines[0]?.lineTotal).toBe(9.99);
  });

  it('folds two detail lines into the item, never one into the other', () => {
    const parsed = fromServerReceipt({
      merchant: {},
      lines: [
        { text: 'BANANAS', kind: ReceiptLineKind.Item, product: 'BANANAS' },
        {
          text: '2.21 lb @ 0.46',
          kind: ReceiptLineKind.Item,
          quantity: 2.21,
          unit: 'lb',
          unitPrice: 0.46,
        },
        {
          text: '1 @ 1.02',
          kind: ReceiptLineKind.Item,
          quantity: 1,
          unitPrice: 1.02,
          amount: 1.02,
        },
      ],
    });

    expect(receiptReviewLines(parsed)).toEqual([
      {
        index: 0,
        printed: 'BANANAS',
        quantity: 2.21,
        unit: 'lb',
        price: 1.02,
      },
    ]);
    expect(parsed.lines[1]).toMatchObject({ kind: 'other', appliesToIndex: 0 });
    expect(parsed.lines[2]).toMatchObject({ kind: 'other', appliesToIndex: 0 });
  });

  it('leaves out a merchant the server could not name', () => {
    expect(fromServerReceipt({ merchant: { name: null }, lines: [] })).toEqual({
      lines: [],
    });
  });
});
