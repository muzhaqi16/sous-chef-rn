import {
  formatCurrency,
  formatDecimal,
  formatNumberForInput,
  resetNumberFormatterCache,
} from '../number';
import { parseDecimalInput } from '#/utils/parseDecimalInput';
import { resetDeviceLocaleCache } from '#/utils/deviceLocale';

const realNumberFormat = Intl.NumberFormat;

function setNumberFormat(impl: typeof Intl.NumberFormat) {
  (Intl as { NumberFormat: typeof Intl.NumberFormat }).NumberFormat = impl;
}

function onLocale(locale: string) {
  resetDeviceLocaleCache();
  resetNumberFormatterCache();
  setNumberFormat(function NumberFormatShim(
    _requested?: unknown,
    options?: Intl.NumberFormatOptions,
  ) {
    return new realNumberFormat(locale, options);
  } as unknown as typeof Intl.NumberFormat);
}

function withoutIntl() {
  resetDeviceLocaleCache();
  resetNumberFormatterCache();
  setNumberFormat((() => {
    throw new Error('Intl.NumberFormat is not available');
  }) as unknown as typeof Intl.NumberFormat);
}

afterEach(() => {
  setNumberFormat(realNumberFormat);
  resetDeviceLocaleCache();
  resetNumberFormatterCache();
});

describe('formatNumberForInput', () => {
  it('uses the separator the keypad offers', () => {
    onLocale('en-US');
    expect(formatNumberForInput(4.99)).toBe('4.99');

    onLocale('es-ES');
    expect(formatNumberForInput(4.99)).toBe('4,99');
  });

  it('omits grouping, which is unusable mid-edit', () => {
    onLocale('es-ES');
    expect(formatNumberForInput(1234.56)).toBe('1234,56');
  });

  it('never rounds, so opening an edit sheet cannot alter the value', () => {
    onLocale('es-ES');
    expect(formatNumberForInput(1.23456789)).toBe('1,23456789');
  });

  it('is empty for values a field cannot show', () => {
    expect(formatNumberForInput(null)).toBe('');
    expect(formatNumberForInput(undefined)).toBe('');
    expect(formatNumberForInput(NaN)).toBe('');
    expect(formatNumberForInput(Infinity)).toBe('');
  });

  describe('round-trips through the parser it feeds', () => {
    it.each([
      ['en-US', 4.99],
      ['en-US', 1234.5],
      ['en-US', 0.5],
      ['en-US', 12],
      ['es-ES', 4.99],
      ['es-ES', 1234.5],
      ['es-ES', 0.5],
      ['es-ES', 12],
      // The value that made the ambiguity rule necessary, from both sides.
      ['en-US', 1.234],
      ['es-ES', 1.234],
      ['en-US', 1234],
      ['es-ES', 1234],
    ])('%s: %p survives format -> parse', (locale, value) => {
      onLocale(locale);
      expect(parseDecimalInput(formatNumberForInput(value))).toBe(value);
    });
  });
});

describe('formatDecimal', () => {
  it('follows the device separator', () => {
    onLocale('en-US');
    expect(formatDecimal(4.5)).toBe('4.5');

    onLocale('es-ES');
    expect(formatDecimal(4.5)).toBe('4,5');
  });

  it('drops a zero fraction by default and keeps it when asked', () => {
    onLocale('en-US');
    expect(formatDecimal(3)).toBe('3');
    expect(
      formatDecimal(3, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ).toBe('3.00');
  });

  it('is empty for values there is nothing to show for', () => {
    expect(formatDecimal(null)).toBe('');
    expect(formatDecimal(NaN)).toBe('');
  });

  it('still matches the input separator with no Intl', () => {
    withoutIntl();
    // The fallback separator is `.`, so both sides agree on the degraded path.
    expect(formatDecimal(4.5)).toBe('4.5');
    expect(
      formatDecimal(3, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    ).toBe('3.00');
  });
});

describe('formatCurrency', () => {
  it('places the symbol where the locale places it', () => {
    onLocale('en-US');
    const enUS = formatCurrency(1234.5, 'USD');
    expect(enUS).toContain('1,234.50');
    expect(enUS.indexOf('$')).toBeLessThan(enUS.indexOf('1'));

    onLocale('es-ES');
    // Spanish groups only from five digits up, so 1234,50 carries no grouping
    // separator — one more thing a hand-rolled `$${n.toFixed(2)}` got wrong.
    const esES = formatCurrency(1234.5, 'EUR');
    expect(esES).toContain('1234,50');
    expect(esES.indexOf('€')).toBeGreaterThan(esES.indexOf('1'));

    expect(formatCurrency(12345.5, 'EUR')).toContain('12.345,50');
  });

  it('falls back to the bare code for a currency Intl rejects', () => {
    onLocale('en-US');
    expect(formatCurrency(4.5, 'NOTACURRENCY')).toBe('NOTACURRENCY 4.50');
  });

  it('formats a plain amount when no currency is known', () => {
    onLocale('en-US');
    expect(formatCurrency(4.5, null)).toBe('4.50');
  });

  it('treats a missing amount as zero, as the call sites expect', () => {
    onLocale('en-US');
    expect(formatCurrency(null, 'USD')).toContain('0.00');
  });
});
