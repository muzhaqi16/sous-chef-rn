import { getI18n } from '#/i18n/config';
import { t } from '#/i18n';
import type { Translate } from '#/i18n/types';
import { daysUntilExpiry, expiryLabel } from '#/domain/expiry';

describe('daysUntilExpiry', () => {
  const now = new Date(2026, 8, 21, 23, 30);

  it('reads the key as a local day, so late evening is still that day', () => {
    expect(daysUntilExpiry('2026-09-21', now)).toBe(0);
    expect(daysUntilExpiry('2026-09-22', now)).toBe(1);
    expect(daysUntilExpiry('2026-09-19', now)).toBe(-2);
  });
});

describe('expiryLabel', () => {
  it.each([
    [-1, 'Expired 1 day ago'],
    [-3, 'Expired 3 days ago'],
    [0, 'Expires today'],
    [1, 'Expires tomorrow'],
    [2, 'Expires in 2 days'],
    [10, 'Expires in 10 days'],
  ])('%i days reads "%s"', (days, expected) => {
    expect(expiryLabel(days, t)).toBe(expected);
  });

  it.each([
    ['es', 'Caduca en 3 días', 'Caducó hace 1 día'],
    ['it', 'Scade tra 3 giorni', 'Scaduto 1 giorno fa'],
    ['sq', 'Skadon për 3 ditë', 'Skaduar 1 ditë më parë'],
  ])('%s pluralises both counted states', (locale, inThree, oneAgo) => {
    const translate: Translate = getI18n().getFixedT(locale);
    expect(expiryLabel(3, translate)).toBe(inThree);
    expect(expiryLabel(-1, translate)).toBe(oneAgo);
  });
});
