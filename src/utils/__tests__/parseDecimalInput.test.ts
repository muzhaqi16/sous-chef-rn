import { parseDecimalInput } from '../parseDecimalInput';

describe('parseDecimalInput', () => {
  describe('the bug it exists for', () => {
    it.each([
      ['4,99', 4.99],
      ['0,5', 0.5],
      ['14,5', 14.5],
      ['3,4', 3.4],
    ])(
      'reads comma-decimal %s as %p (parseFloat silently gave the integer part)',
      (input, expected) => {
        expect(parseDecimalInput(input)).toBe(expected);
        // The regression being fixed: parseFloat truncates at the comma.
        expect(parseFloat(input)).not.toBe(expected);
      },
    );
  });

  describe('period decimals still work', () => {
    it.each([
      ['4.99', 4.99],
      ['0.5', 0.5],
      ['12', 12],
      ['0', 0],
      ['.5', 0.5],
    ])('%s -> %p', (input, expected) => {
      expect(parseDecimalInput(input)).toBe(expected);
    });
  });

  describe('both separators present — the last one is the decimal', () => {
    it.each([
      ['1.234,56', 1234.56],
      ['1,234.56', 1234.56],
      ['1.234.567,89', 1234567.89],
      ['1,234,567.89', 1234567.89],
    ])('%s -> %p', (input, expected) => {
      expect(parseDecimalInput(input)).toBe(expected);
    });
  });

  describe('repeated single separator in grouping positions', () => {
    it.each([
      ['1.234.567', 1234567],
      ['1,234,567', 1234567],
    ])('%s -> %p', (input, expected) => {
      expect(parseDecimalInput(input)).toBe(expected);
    });
  });

  it('treats a lone separator as a decimal point even before three digits', () => {
    // Documented trade-off: a decimal-pad only offers its locale's DECIMAL
    // separator, never a grouping one, so a single separator from that keyboard
    // is always a decimal point. Also strictly better than the parseFloat it
    // replaces, which read this as 1.
    expect(parseDecimalInput('1,234')).toBe(1.234);
    expect(parseFloat('1,234')).toBe(1);
  });

  describe('NaN contract, so `|| 1` and `Number.isNaN` call sites keep working', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'whitespace'],
      ['abc', 'letters'],
      [',', 'bare separator'],
    ])('%s (%s) is NaN', input => {
      expect(parseDecimalInput(input)).toBeNaN();
    });

    it('is NaN for null and undefined', () => {
      expect(parseDecimalInput(null)).toBeNaN();
      expect(parseDecimalInput(undefined)).toBeNaN();
    });

    it('falls back like parseFloat at the call sites', () => {
      expect(parseDecimalInput('') || 1).toBe(1);
      expect(parseDecimalInput('abc') || undefined).toBeUndefined();
    });
  });

  it('ignores surrounding and embedded whitespace', () => {
    expect(parseDecimalInput('  4,99  ')).toBe(4.99);
    expect(parseDecimalInput('1 234,56')).toBe(1234.56);
  });

  it('keeps negative numbers signed', () => {
    expect(parseDecimalInput('-4,99')).toBe(-4.99);
  });
});
