import { readReceiptLine } from '../readReceiptLine';

describe('readReceiptLine', () => {
  it('reads the amount before the tax flags, and the product code', () => {
    expect(readReceiptLine('GV WHOLE MILK 007874235186 F  3.48 N')).toEqual({
      amount: 3.48,
      code: '007874235186',
    });
    expect(readReceiptLine('E 1234567 KS WATER 40PK  4.99 A')).toEqual({
      amount: 4.99,
      code: '1234567',
    });
    expect(readReceiptLine('0001111041700 KRO WHL MILK  3.29 F')).toEqual({
      amount: 3.29,
      code: '0001111041700',
    });
  });

  it('reads a pack size as no code, run together or spaced', () => {
    expect(readReceiptLine('JUICE 1750ML  3.49')).toEqual({ amount: 3.49 });
    expect(readReceiptLine('RICE 2000 G  4.29')).toEqual({ amount: 4.29 });
    expect(readReceiptLine('OIL 1000 ml  5.99')).toEqual({ amount: 5.99 });
    expect(readReceiptLine('000000040110KF BANANAS  1.02')).toEqual({
      amount: 1.02,
      code: '000000040110',
    });
    expect(readReceiptLine('AVOCADO 4046 EA  1.00')).toEqual({
      amount: 1,
      code: '4046',
    });
  });

  it('reads a minus on either side as a discount', () => {
    expect(readReceiptLine('SC KROGER SAVINGS  0.50-')).toEqual({
      amount: -0.5,
    });
    expect(readReceiptLine('/ 987654 TPD/EGGS  1.50-')).toEqual({
      amount: -1.5,
      code: '987654',
    });
    expect(readReceiptLine('COUPON  -1.00')).toEqual({ amount: -1 });
  });

  it('reads a count or a weight at a unit price', () => {
    expect(readReceiptLine('2 @ 1.99')).toEqual({
      quantity: 2,
      unitPrice: 1.99,
    });
    expect(readReceiptLine('2.14 lb @ 0.59 /lb')).toEqual({
      quantity: 2.14,
      unit: 'lb',
      unitPrice: 0.59,
    });
    expect(readReceiptLine('3 @ 2.49  7.47')).toEqual({
      quantity: 3,
      unitPrice: 2.49,
      amount: 7.47,
    });
    // ALDI UK writes the count with an x.
    expect(readReceiptLine('2 x  2.19')).toEqual({
      quantity: 2,
      unitPrice: 2.19,
    });
  });

  it('reads a weight at a rate per one unit, as Walmart prints it', () => {
    const weighed = { quantity: 2.21, unit: 'lb', unitPrice: 0.46 };
    expect(readReceiptLine('2.21 lb @ 1 lb /0.46')).toEqual(weighed);
    // As recognition reads it: a full stop after each unit, `lb` as `1b`.
    expect(readReceiptLine('2.21 lb. @ 1 1b. /0.46')).toEqual(weighed);
    expect(readReceiptLine('2.211b. @ 1 lb. /0.46  1.02 R')).toEqual({
      ...weighed,
      amount: 1.02,
    });
  });

  it('reads a unit price printed without its leading zero', () => {
    expect(readReceiptLine('PLUMS  2.54 lb @ .99/lb  2.51')).toEqual({
      quantity: 2.54,
      unit: 'lb',
      unitPrice: 0.99,
      amount: 2.51,
    });
  });

  it('reads no price from a deal line (Giant Eagle)', () => {
    expect(readReceiptLine('1 @ 2/3.00')).toEqual({});
    expect(readReceiptLine('1 @ 2/$4.00')).toEqual({});
  });

  it('takes the line amount, not a percentage or a phone number', () => {
    expect(readReceiptLine('TAX 1 6.000 %  0.00')).toEqual({ amount: 0 });
    expect(readReceiptLine('STORE #1234 (555) 555-1234')).toEqual({
      code: '1234',
    });
    expect(readReceiptLine('**** BALANCE  $7.03')).toEqual({ amount: 7.03 });
    expect(readReceiptLine('LATTE  4,50')).toEqual({ amount: 4.5 });
  });

  it('reads nothing from a line with no figures', () => {
    expect(readReceiptLine('BANANAS')).toEqual({});
    expect(readReceiptLine('THANK YOU')).toEqual({});
  });
});
