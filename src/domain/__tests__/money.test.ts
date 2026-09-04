import { renderHook } from '@testing-library/react-native';
import {
  resolveCurrency,
  useMoney,
  usePreferredCurrency,
} from '#/domain/money';
import { useStore } from '#store';
import { DEFAULT_CURRENCY, UNKNOWN_AMOUNT } from '#/utils/formatters/number';

const EUR = { code: 'EUR' };

describe('resolveCurrency', () => {
  it('prefers the currency the API named for the figure', () => {
    // A cost recorded in euros is euros. Re-labelling it with the reader's
    // preference would report money the account never spent.
    expect(resolveCurrency(EUR, 'USD')).toBe('EUR');
  });

  it('falls back to the account preference for an undenominated figure', () => {
    expect(resolveCurrency(null, 'GBP')).toBe('GBP');
    expect(resolveCurrency(undefined, 'GBP')).toBe('GBP');
  });

  it('falls back to the documented default when the account has none', () => {
    expect(resolveCurrency(null, '')).toBe(DEFAULT_CURRENCY);
  });
});

describe('the account currency', () => {
  afterEach(() => {
    useStore.getState().setPreferredCurrency(DEFAULT_CURRENCY);
  });

  it('is the documented default until the person states one', () => {
    const { result } = renderHook(() => usePreferredCurrency());
    expect(result.current).toBe(DEFAULT_CURRENCY);
  });

  it('drives an undenominated figure', () => {
    useStore.getState().setPreferredCurrency('JPY');
    const { result } = renderHook(() => useMoney());
    // JPY has no minor unit, so this also pins that the preference carries the
    // currency's own fraction digits rather than a fixed two.
    const shown = result.current(1234, null);
    expect(shown).toContain('1,234');
    expect(shown).not.toContain('1,234.00');
  });

  it('does not override a figure that names its own currency', () => {
    useStore.getState().setPreferredCurrency('JPY');
    const { result } = renderHook(() => useMoney());
    // Under the test locale (en-US) that is `€1,234.00` — the point is the
    // EURO symbol rather than the yen the preference would have given.
    expect(result.current(1234, EUR)).toContain('€');
    expect(result.current(1234, EUR)).toContain('1,234.00');
  });

  it('reads an absent amount as unknown whatever the currency', () => {
    const { result } = renderHook(() => useMoney());
    expect(result.current(null, EUR)).toBe(UNKNOWN_AMOUNT);
    expect(result.current(undefined, null)).toBe(UNKNOWN_AMOUNT);
  });
});
