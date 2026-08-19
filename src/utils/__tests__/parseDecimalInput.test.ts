import {
  normalizeNumericTextForApi,
  parseDecimalInput,
} from '../parseDecimalInput';
import { getDeviceDecimalSeparator } from '../deviceLocale';

jest.mock('../deviceLocale', () => ({
  getDeviceDecimalSeparator: jest.fn(() => '.'),
}));

const onDeviceWithSeparator = (separator: '.' | ',') => {
  (getDeviceDecimalSeparator as jest.Mock).mockReturnValue(separator);
};

beforeEach(() => {
  // Every case outside the ambiguity block must hold on either device, so
  // default to one and let that block pick explicitly.
  onDeviceWithSeparator('.');
});

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

  describe('a lone separator before exactly three digits asks the device', () => {
    // The one input the text cannot settle. `1,234` is 1.234 to someone whose
    // keypad types `,` and 1234 to someone whose keypad types `.`, and both are
    // typing the number they meant.
    it('reads the device separator as a decimal point', () => {
      onDeviceWithSeparator('.');
      expect(parseDecimalInput('1.234')).toBe(1.234);

      onDeviceWithSeparator(',');
      expect(parseDecimalInput('1,234')).toBe(1.234);
    });

    it('reads the other separator as grouping', () => {
      onDeviceWithSeparator('.');
      expect(parseDecimalInput('1,234')).toBe(1234);

      onDeviceWithSeparator(',');
      expect(parseDecimalInput('1.234')).toBe(1234);
    });

    it('is better than the parseFloat it replaces under either reading', () => {
      // parseFloat truncated at the separator regardless: 1, never 1.234 or 1234.
      expect(parseFloat('1,234')).toBe(1);
    });

    describe('digit shapes no locale groups are decimals on any device', () => {
      it.each([
        // Four trailing digits — grouping is always three.
        ['1,2345', 1.2345],
        // Four leading digits — the first group would have to be one to three.
        ['1234,567', 1234.567],
        // A leading zero is not written in a grouped integer.
        ['0,123', 0.123],
        // Fewer than three trailing digits.
        ['1,23', 1.23],
      ])('%s -> %p on a period-decimal device', (input, expected) => {
        onDeviceWithSeparator('.');
        expect(parseDecimalInput(input)).toBe(expected);
      });
    });

    it('leaves multi-separator input to the position rules', () => {
      // Ambiguity resolution is scoped to a single separator; `1.234,56` is
      // already settled by the two-different-separators rule.
      onDeviceWithSeparator(',');
      expect(parseDecimalInput('1.234,56')).toBe(1234.56);
      expect(parseDecimalInput('1.234.567')).toBe(1234567);
    });
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

describe('fractions are declined, not guessed at', () => {
  // Stripping the space out of `1 1/2` leaves `11/2`, which parseFloat reads as
  // 11 — a number nobody typed, written straight to the cache. Quantity fields
  // offer `1 1/4` in their own placeholder, so this input is expected, not
  // exotic; `parseFractionalInput` is the parser for it.
  it.each(['1 1/2', '3/4', '1 1/4', '1/2'])('%s is NaN', input => {
    expect(parseDecimalInput(input)).toBeNaN();
  });

  it('does not silently produce 11 for one and a half', () => {
    expect(parseDecimalInput('1 1/2')).not.toBe(11);
  });
});

describe('normalizeNumericTextForApi', () => {
  it('rewrites the decimal separator the server rejects', () => {
    onDeviceWithSeparator(',');
    // Verified against the dev API: `4,99` comes back as
    // `ValidationError: Invalid fraction format: 4,99`.
    expect(normalizeNumericTextForApi('4,99')).toBe('4.99');
  });

  it('leaves a value already in the machine convention alone', () => {
    onDeviceWithSeparator('.');
    expect(normalizeNumericTextForApi('4.99')).toBe('4.99');
    expect(normalizeNumericTextForApi('12')).toBe('12');
  });

  it('preserves fractions and mixed numbers exactly as typed', () => {
    // Parsing to a number instead would send `1.5`, and the server stores this
    // string as the display form — the person's `1 1/2` would vanish from screen.
    onDeviceWithSeparator(',');
    expect(normalizeNumericTextForApi('1 1/2')).toBe('1 1/2');
    expect(normalizeNumericTextForApi('3/4')).toBe('3/4');
  });

  it('strips grouping separators', () => {
    onDeviceWithSeparator(',');
    expect(normalizeNumericTextForApi('1.234,56')).toBe('1234.56');
    onDeviceWithSeparator('.');
    expect(normalizeNumericTextForApi('1,234.56')).toBe('1234.56');
  });

  it('resolves the ambiguous case the same way the parser does', () => {
    onDeviceWithSeparator('.');
    expect(normalizeNumericTextForApi('1,234')).toBe('1234');
    expect(parseDecimalInput('1,234')).toBe(1234);

    onDeviceWithSeparator(',');
    expect(normalizeNumericTextForApi('1,234')).toBe('1.234');
    expect(parseDecimalInput('1,234')).toBe(1.234);
  });
});
