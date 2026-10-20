import { dateOrderOf } from '@muzhaqi16/receipt-rules';

// The order a receipt's day is read in, for each language the app ships; the
// package's own suite holds only en-US, en-GB and de-DE.
describe('dateOrderOf, for the app’s locales', () => {
  it.each([
    ['en-US', 'monthFirst'],
    ['en-GB', 'dayFirst'],
    ['es-ES', 'dayFirst'],
    ['it-IT', 'dayFirst'],
    ['sq-AL', 'dayFirst'],
  ])('%s writes the date %s', (locale, expected) => {
    expect(dateOrderOf(locale)).toBe(expected);
  });

  it('falls back to month-first when Intl is unavailable', () => {
    const spy = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl.DateTimeFormat is not available');
    });

    expect(dateOrderOf(null)).toBe('monthFirst');
    spy.mockRestore();
  });
});
