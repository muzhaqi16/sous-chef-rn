import { getI18n } from '#/i18n/config';
import {
  formatDateRange,
  formatDayOfMonth,
  formatFullWeekdayMonthDay,
  formatMonthDay,
  formatMonthDayYear,
  formatMonthYear,
  formatWeekdayMonthDay,
  formatWeekdayShort,
} from '../date';

/**
 * `format(date, 'MMM d')` with no `locale` renders English whatever the app is
 * set to — not as a fallback, but as date-fns' default, permanently. These
 * assertions are the difference: they read the LIVE language, so a date shown
 * to a Spanish reader is Spanish.
 */
jest.mock('#/i18n/config', () => ({ getI18n: jest.fn() }));

const speak = (language: string) =>
  (getI18n as jest.Mock).mockReturnValue({
    resolvedLanguage: language,
    language,
  });

// 4 November 2026 was a Wednesday.
const date = new Date(2026, 10, 4);

describe('display date formatters', () => {
  beforeEach(() => speak('en'));

  it('formats in English by default', () => {
    expect(formatMonthDay(date)).toBe('Nov 4');
    expect(formatMonthDayYear(date)).toBe('Nov 4, 2026');
    expect(formatWeekdayMonthDay(date)).toBe('Wed, Nov 4');
    expect(formatFullWeekdayMonthDay(date)).toBe('Wednesday, November 4');
    expect(formatMonthYear(date)).toBe('November 2026');
    expect(formatWeekdayShort(date)).toBe('Wed');
    expect(formatDayOfMonth(date)).toBe('4');
  });

  it('follows a language change, which is the whole point', () => {
    speak('es');
    expect(formatMonthYear(date)).toBe('noviembre 2026');
    expect(formatWeekdayShort(date)).toBe('mié');

    speak('it');
    expect(formatMonthYear(date)).toBe('novembre 2026');

    speak('sq');
    expect(formatMonthYear(date)).not.toBe('November 2026');
  });

  it('reads the language on EVERY call, not once at import', () => {
    // A formatter that captured the locale at module scope would return the
    // first language forever — which is what a module-level `format` bound to
    // a locale constant would do.
    expect(formatMonthYear(date)).toBe('November 2026');
    speak('es');
    expect(formatMonthYear(date)).toBe('noviembre 2026');
    speak('en');
    expect(formatMonthYear(date)).toBe('November 2026');
  });

  it('falls back to English for a language it does not ship', () => {
    speak('de');
    expect(formatMonthDay(date)).toBe('Nov 4');
  });

  it('ignores a region suffix', () => {
    speak('es-MX');
    expect(formatMonthYear(date)).toBe('noviembre 2026');
  });

  it('joins a range with an en dash', () => {
    expect(formatDateRange(date, new Date(2026, 10, 10))).toBe(
      'Nov 4 – Nov 10',
    );
  });
});
