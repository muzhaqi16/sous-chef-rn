import { readReceiptDate } from '../receiptDate';

const TODAY = '2026-09-30';

describe('readReceiptDate', () => {
  it.each([
    ['Walmart, two-digit year with a time', '09/30/26 14:22:31', '2026-09-30'],
    ['Kroger, no leading zeros', 'DATE 9/28/2026 2:15pm', '2026-09-28'],
    ['ISO', 'Printed 2026-09-27T18:04', '2026-09-27'],
  ])('reads %s', (_label, line, expected) => {
    expect(
      readReceiptDate(['WALMART', `TOTAL 16.69\n${line}`], TODAY, 'monthFirst'),
    ).toBe(expected);
  });

  it('skips a later date, such as the last day to return', () => {
    expect(
      readReceiptDate(
        ['RETURN BY 12/29/26\n09/30/26 14:22'],
        TODAY,
        'monthFirst',
      ),
    ).toBe('2026-09-30');
  });

  it('skips what is not a real day or is too old to be this shop', () => {
    expect(
      readReceiptDate(['02/30/26 13/13/26 01/05/24'], TODAY, 'monthFirst'),
    ).toBeNull();
  });

  it('finds none in a receipt that prints no date', () => {
    expect(
      readReceiptDate(
        ['GV WHOLE MILK 3.48', 'TOTAL 3.48'],
        TODAY,
        'monthFirst',
      ),
    ).toBe(null);
  });

  it('takes the first date in reading order, across pages', () => {
    expect(
      readReceiptDate(
        ['STORE 4412\n09/29/26 08:01', '09/30/26'],
        TODAY,
        'monthFirst',
      ),
    ).toBe('2026-09-29');
  });

  it.each([
    ['day-first', 'dayFirst', '2026-09-05'],
    ['month-first', 'monthFirst', '2026-05-09'],
  ] as const)(
    'reads a date both orders allow in a %s region',
    (_label, order, expected) => {
      expect(readReceiptDate(['05/09/2026 10:12'], TODAY, order)).toBe(
        expected,
      );
    },
  );

  it.each(['dayFirst', 'monthFirst'] as const)(
    'reads a date only one order allows in that order (%s region)',
    order => {
      expect(readReceiptDate(['30/09/2026'], TODAY, order)).toBe('2026-09-30');
      expect(readReceiptDate(['13/01/26'], TODAY, order)).toBe('2026-01-13');
    },
  );
});
