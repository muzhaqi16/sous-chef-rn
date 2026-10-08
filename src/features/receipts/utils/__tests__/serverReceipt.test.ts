import { CombinedGraphQLErrors, ServerError } from '@apollo/client/errors';
import {
  ErrorCode,
  ReceiptLineKind,
  ReceiptParseStatus,
  ReceiptParseWarningCode,
  TopLevelErrorCode,
} from '#/graphql/generated/schemaTypes';
import type { ReceiptParseReadersFragment } from '#/graphql/readers/receiptParseReaders.generated';
import { classifyCreateResult, outcomeOf } from '../serverReceipt';
import { fromServerReceipt } from '../fromServerReceipt';
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

  it('copies the figures the server gives, and reads none from the text', () => {
    const parsed = fromServerReceipt({
      merchant: merchant('Walmart'),
      lines: [
        line({
          text: 'BANANAS  000000040110KF  1.02 R',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          code: '000000040110',
          quantity: 2.21,
          unit: 'lb',
          unitPrice: 0.46,
          amount: 1.02,
        }),
        // The text prints a code and a price the server did not give.
        line({
          text: 'DEVILED EGG 078742213510 F 4.96',
          kind: ReceiptLineKind.Item,
          product: 'DEVILED EGG',
        }),
      ],
    });

    expect(parsed.lines).toEqual([
      {
        index: 0,
        rawText: 'BANANAS  000000040110KF  1.02 R',
        kind: 'item',
        product: 'BANANAS',
        code: '000000040110',
        quantity: 2.21,
        unit: 'lb',
        unitPrice: 0.46,
        lineTotal: 1.02,
      },
      {
        index: 1,
        rawText: 'DEVILED EGG 078742213510 F 4.96',
        kind: 'item',
        product: 'DEVILED EGG',
      },
    ]);
  });

  it('keeps a folded detail line out of the review and never subtracts it', () => {
    const parsed = fromServerReceipt({
      merchant: merchant(null),
      lines: [
        line({
          text: 'BANANAS 1.02',
          kind: ReceiptLineKind.Item,
          product: 'BANANAS',
          quantity: 2.21,
          unit: 'lb',
          amount: 1.02,
        }),
        // As the server folds it: its figures moved onto the item.
        line({
          text: '2.21 lb @ 0.46',
          kind: ReceiptLineKind.Other,
          appliesTo: 0,
        }),
      ],
    });

    expect(parsed.lines[1]).toMatchObject({ kind: 'other', appliesToIndex: 0 });
    expect(receiptReviewLines(parsed)).toEqual([
      { index: 0, printed: 'BANANAS', quantity: 2.21, unit: 'lb', price: 1.02 },
    ]);
  });

  it("prices the review's rows to the sum the server counted", () => {
    const parse: ReceiptParseReadersFragment = {
      __typename: 'ReceiptParse',
      id: 'rp-totals',
      status: ReceiptParseStatus.Parsed,
      warnings: [
        {
          __typename: 'ReceiptParseWarning',
          code: ReceiptParseWarningCode.TotalsMismatch,
          counted: 4.05,
          printed: 4.55,
        },
      ],
      receipt: {
        __typename: 'ParsedReceipt',
        purchasedOn: null,
        merchant: merchant('KROGER'),
        lines: [
          line({
            text: 'KRO WHL MILK 3.29 F',
            kind: ReceiptLineKind.Item,
            product: 'KRO WHL MILK',
            amount: 3.29,
          }),
          line({
            text: 'SC KROGER SAVINGS 0.50-',
            kind: ReceiptLineKind.Discount,
            amount: -0.5,
            appliesTo: 0,
          }),
          line({
            text: 'BANANAS 1.26',
            kind: ReceiptLineKind.Item,
            product: 'BANANAS',
            quantity: 2.14,
            unit: 'lb',
            amount: 1.26,
          }),
          line({
            text: '2.14 lb @ 0.59 /lb',
            kind: ReceiptLineKind.Other,
            appliesTo: 2,
          }),
          line({
            text: 'SUBTOTAL 4.55',
            kind: ReceiptLineKind.Subtotal,
            amount: 4.55,
          }),
        ],
      },
    };

    const outcome = outcomeOf(parse);
    const parsed = typeof outcome === 'object' ? outcome.parsed : null;
    const shownCents = receiptReviewLines(parsed ?? { lines: [] }).reduce(
      (sum, row) => sum + Math.round((row.price ?? 0) * 100),
      0,
    );

    expect(outcome).toMatchObject({
      totalsGap: { counted: 4.05, printed: 4.55 },
    });
    expect(shownCents).toBe(405);
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
