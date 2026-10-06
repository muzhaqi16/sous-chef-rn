import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import {
  ErrorCode,
  ReceiptLineKind,
  ReceiptParseStatus,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import type { ReceiptParseReadersFragment } from '#/graphql/readers/receiptParseReaders.generated';
import { classifyCreateResult, fromServerReceipt } from '../serverReceipt';
import { receiptReviewLines } from '../receiptReviewLines';
import { receiptTotalsGap } from '../receiptTotalsGap';

type ServerReceipt = NonNullable<ReceiptParseReadersFragment['receipt']>;
type ServerLine = ServerReceipt['lines'][number];

/** A line as the API returns it: a field it leaves out is null. */
const line = (
  fields: Pick<ServerLine, 'text' | 'kind'> & Partial<ServerLine>,
): ServerLine => ({
  __typename: 'ParsedReceiptLine',
  product: null,
  code: null,
  quantity: null,
  unit: null,
  unitPrice: null,
  amount: null,
  appliesTo: null,
  ...fields,
});

const merchant = (name: string | null): ServerReceipt['merchant'] => ({
  __typename: 'ParsedReceiptMerchant',
  name,
  address: null,
  storeNumber: null,
});

describe('fromServerReceipt', () => {
  const receipt = {
    merchant: merchant(' KROGER '),
    lines: [
      line({ text: 'KROGER #412', kind: ReceiptLineKind.Other }),
      line({
        text: 'KRO WHL MILK 3.29 F',
        kind: ReceiptLineKind.Item,
        product: 'KRO WHL MILK',
        code: '0001111041700',
        amount: 3.29,
      }),
      line({
        text: 'SC KROGER SAVINGS 0.50-',
        kind: ReceiptLineKind.Discount,
        amount: -0.5,
        appliesTo: 1,
      }),
      line({
        text: 'BANANAS 2.14 lb @ 0.59 /lb 1.26',
        kind: ReceiptLineKind.Item,
        product: 'BANANAS',
        quantity: 2.14,
        unit: 'lb',
        unitPrice: 0.59,
        amount: 1.26,
      }),
      line({
        text: 'BOTTLE DEPOSIT 0.10',
        kind: ReceiptLineKind.Deposit,
        amount: 0.1,
      }),
      line({
        text: 'SUBTOTAL 4.15',
        kind: ReceiptLineKind.Subtotal,
        amount: 4.15,
      }),
      line({ text: 'TAX 0.00', kind: ReceiptLineKind.Tax, amount: 0 }),
      line({ text: 'VISA 4.15', kind: ReceiptLineKind.Payment, amount: 4.15 }),
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
      merchant: merchant('WALMART'),
      lines: [
        line({
          text: 'BANANAS 000000040110KF 1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          code: '000000040110',
          amount: 1.02,
        }),
        line({ text: '2.21 lb @ 1 lb /0.46', kind: ReceiptLineKind.Item }),
        // An item whose price the server missed stays an item.
        line({
          text: 'PRG CHED SC 038000138970',
          kind: ReceiptLineKind.Item,
          product: 'PRG CHED SC',
          code: '038000138970',
        }),
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
  // walmart-food-receipt-8-sep-2021), with the codes and units the server now
  // keeps (`normalizeLines` drops the tax flag `R` given as a unit).
  it("takes the figures the line prints over the server's", () => {
    const parsed = fromServerReceipt({
      merchant: merchant('Walmart'),
      lines: [
        line({
          text: 'BANANAS  000000040110KF  1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          quantity: 1,
          amount: 4.94,
        }),
        line({
          text: '2.21 lb. @ 1 1b. /0.46  4.94 Y',
          kind: ReceiptLineKind.Item,
          product: '2.21 lb. @ 1 1b. /0.46',
          amount: 4.94,
        }),
        line({
          text: 'DEVILED EGG 078742213510 F  4.96 R',
          kind: ReceiptLineKind.Item,
          product: 'DEVILED EGG',
          quantity: 1,
          amount: 4.96,
        }),
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

  it('keeps the code the server kept, and reads one it was not given', () => {
    const parsed = fromServerReceipt({
      merchant: merchant(null),
      lines: [
        line({
          text: 'MILK 131 2.49',
          kind: ReceiptLineKind.Item,
          product: 'MILK',
          code: '131',
          amount: 2.49,
        }),
        line({
          text: 'DEVILED EGG 078742213510 F 4.96',
          kind: ReceiptLineKind.Item,
          product: 'DEVILED EGG',
          amount: 4.96,
        }),
      ],
    });

    expect(parsed.lines.map(parsedLine => parsedLine.code)).toEqual([
      '131',
      '078742213510',
    ]);
  });

  // As the dev parser answered for the same receipt read on the simulator,
  // with the codes and units the server now keeps.
  it('takes no subtotal for an item price', () => {
    const parsed = fromServerReceipt({
      merchant: merchant('Walmart'),
      lines: [
        line({
          text: 'BANANAS  000000040110KF  1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          code: '000000040110',
          quantity: 1,
          amount: 1.02,
        }),
        line({
          text: '2.21 lb. @ 1lb.  /0.46  4.94 Y',
          kind: ReceiptLineKind.Item,
          product: '2.21 lb. @ 1lb.',
          quantity: 2.21,
          unit: 'lb',
          amount: 4.94,
        }),
        line({
          text: 'DEVILED EGG  078742213510 F  4.96 R',
          kind: ReceiptLineKind.Item,
          product: 'DEVILED EGG',
          code: '078742213510',
          amount: 4.96,
        }),
        line({
          text: 'PRG CHED SC  038000138970',
          kind: ReceiptLineKind.Item,
          product: 'PRG CHED SC',
          code: '038000138970',
          quantity: 1,
          amount: 27.13,
        }),
        line({
          text: 'SUBTOTAL',
          kind: ReceiptLineKind.Subtotal,
          amount: 27.13,
        }),
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
      merchant: merchant('Walmart'),
      lines: [
        line({
          text: 'GV WHOLE MILK 007874235186 F 3.48 N',
          kind: ReceiptLineKind.Item,
          product: 'GV WHOLE MILK',
          amount: 3.48,
        }),
        line({
          text: 'SUBTOTAL 3.48',
          kind: ReceiptLineKind.Subtotal,
          amount: 3.48,
        }),
      ],
    });

    expect(parsed.lines[0]?.lineTotal).toBe(3.48);
  });

  it('keeps an item price its own line prints, though it is the subtotal', () => {
    const parsed = fromServerReceipt({
      merchant: merchant(null),
      lines: [
        line({
          text: 'COFFEE  9.99',
          kind: ReceiptLineKind.Item,
          product: 'COFFEE',
          amount: 9.99,
        }),
        line({
          text: 'MUG  0.00',
          kind: ReceiptLineKind.Item,
          product: 'MUG',
          amount: 0,
        }),
        line({
          text: 'SUBTOTAL 9.99',
          kind: ReceiptLineKind.Subtotal,
          amount: 9.99,
        }),
      ],
    });

    expect(parsed.lines[0]?.lineTotal).toBe(9.99);
  });

  it('folds two detail lines into the item, never one into the other', () => {
    const parsed = fromServerReceipt({
      merchant: merchant(null),
      lines: [
        line({
          text: 'BANANAS',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
        }),
        line({
          text: '2.21 lb @ 0.46',
          kind: ReceiptLineKind.Item,
          quantity: 2.21,
          unit: 'lb',
          unitPrice: 0.46,
        }),
        line({
          text: '1 @ 1.02',
          kind: ReceiptLineKind.Item,
          quantity: 1,
          unitPrice: 1.02,
          amount: 1.02,
        }),
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

  // The server gives every item a quantity; only a printed one is a detail's.
  it('keeps items with short or non-Latin names as items of their own', () => {
    const parsed = fromServerReceipt({
      merchant: merchant('MARKET'),
      lines: [
        line({
          text: 'BUKË 1.20',
          kind: ReceiptLineKind.Item,
          product: 'BUKË',
          quantity: 1,
          amount: 1.2,
        }),
        line({
          text: 'UJË 0.50',
          kind: ReceiptLineKind.Item,
          product: 'UJË',
          quantity: 1,
          amount: 0.5,
        }),
        line({
          text: 'OJ 2.99',
          kind: ReceiptLineKind.Item,
          product: 'OJ',
          quantity: 1,
          amount: 2.99,
        }),
        line({
          text: 'МОЛОКО 2 x 1.20 2.40',
          kind: ReceiptLineKind.Item,
          product: 'МОЛОКО',
          quantity: 2,
          unitPrice: 1.2,
          amount: 2.4,
        }),
      ],
    });

    expect(receiptReviewLines(parsed)).toEqual([
      { index: 0, printed: 'BUKË', quantity: 1, price: 1.2 },
      { index: 1, printed: 'UJË', quantity: 1, price: 0.5 },
      { index: 2, printed: 'OJ', quantity: 1, price: 2.99 },
      { index: 3, printed: 'МОЛОКО', quantity: 2, price: 2.4 },
    ]);
  });

  it('leaves out a merchant the server could not name', () => {
    expect(fromServerReceipt({ merchant: merchant(null), lines: [] })).toEqual({
      lines: [],
    });
  });
});

describe('classifyCreateResult', () => {
  const refusedWith = (code: string) =>
    new CombinedGraphQLErrors({
      errors: [{ message: 'refused', extensions: { code } }],
    });
  const httpStatus = (status: number) =>
    new ServerError('HTTP', {
      response: new Response('', { status }),
      bodyText: '',
    });
  const ask = (error: unknown, refusedField: string | null = null) =>
    classifyCreateResult(
      { accepted: false, parse: null, refusedField, error },
      Date.parse('2026-10-06T12:00:00Z'),
    ).kind;

  it('polls an accepted parse that is still running', () => {
    const running: ReceiptParseReadersFragment = {
      __typename: 'ReceiptParse',
      id: 'rp-1',
      status: ReceiptParseStatus.Pending,
      warnings: [],
      receipt: null,
    };
    expect(
      classifyCreateResult({
        accepted: true,
        parse: running,
        refusedField: null,
        error: undefined,
      }),
    ).toEqual({ kind: 'poll' });
  });

  it('settles a refusal on the pages as too long', () => {
    expect(
      classifyCreateResult({
        accepted: false,
        parse: null,
        refusedField: 'pages',
        error: undefined,
      }),
    ).toEqual({ kind: 'settle', outcome: 'tooLong' });
  });

  it.each([
    ['a refusal in the payload', undefined],
    [
      'a request the API refuses as invalid',
      refusedWith(ErrorCode.ValidationFailed),
    ],
    ['a forbidden request', httpStatus(403)],
  ])('settles %s as the verdict it is', (_, error) => {
    expect(ask(error)).toBe('settle');
  });

  it.each([
    ['a server fault', httpStatus(502)],
    ['an internal error', refusedWith(TopLevelErrorCode.InternalServerError)],
    ['a traffic limit on the connection', httpStatus(429)],
    ['a request timeout', httpStatus(408)],
    ['a session mid-refresh', httpStatus(401)],
    ['a request that never left', new Error('Network request failed')],
  ])('resends after %s', (_, error) => {
    expect(ask(error)).toBe('resend');
  });

  it('waits for the next visit when the app must be updated', () => {
    expect(ask(refusedWith(TopLevelErrorCode.ClientUpgradeRequired))).toBe(
      'later',
    );
  });
});
