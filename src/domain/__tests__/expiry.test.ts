import { getI18n } from '#i18n/config';
import { t } from '#i18n';
import type { Translate } from '#i18n/types';
import { ExpiryKind } from '#graphql/generated/schemaTypes';
import {
  compareExpiry,
  daysUntilExpiry,
  expiryAlert,
  expiryFromDays,
  expiryLabel,
  expiryWhen,
  readExpiry,
} from '#domain/expiry';

describe('daysUntilExpiry', () => {
  const today = '2026-09-21';

  it('counts calendar days from the given day', () => {
    expect(daysUntilExpiry('2026-09-21', today)).toBe(0);
    expect(daysUntilExpiry('2026-09-22', today)).toBe(1);
    expect(daysUntilExpiry('2026-09-19', today)).toBe(-2);
    expect(daysUntilExpiry('2026-10-01', today)).toBe(10);
  });
});

/**
 * Every surface's tone and text read one state, so none can split at its own
 * boundary. Every boundary is pinned, so a new state cannot land on one side.
 */
describe('the expiry ladder', () => {
  it.each([
    [-8, 'passed', 'danger'],
    [-1, 'passed', 'danger'],
    [0, 'today', 'warning'],
    [1, 'soon', 'warning'],
    // The badge's window: every item `PantryStats.expiringCount` counts.
    [7, 'soon', 'warning'],
    [8, 'later', null],
  ])('a stated date %i days away is %s, raising %s', (days, state, alert) => {
    for (const kind of [
      ExpiryKind.Label,
      ExpiryKind.PerishableEstimate,
      null,
    ]) {
      const reading = expiryFromDays(days, kind);
      expect(reading.state).toBe(state);
      expect(expiryAlert(reading)).toBe(alert);
    }
  });

  // The bug in one line: today has not expired.
  it('does not call an item expiring today expired', () => {
    expect(expiryAlert(expiryFromDays(0, ExpiryKind.Label))).toBe('warning');
  });

  it.each([
    [-30, 'check'],
    [-1, 'check'],
    [0, 'later'],
    [5, 'later'],
  ])(
    'a long-life estimate %i days away is %s and never alerts',
    (days, state) => {
      const reading = expiryFromDays(days, ExpiryKind.LongLifeEstimate);
      expect(reading.state).toBe(state);
      expect(expiryAlert(reading)).toBeNull();
    },
  );

  it('reads no date as no reading', () => {
    expect(readExpiry(null, ExpiryKind.Label, '2026-09-21')).toBeNull();
    expect(expiryAlert(null)).toBeNull();
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
  ])('a stated date %i days away reads "%s"', (days, expected) => {
    expect(expiryLabel(expiryFromDays(days, ExpiryKind.Label), t)).toBe(
      expected,
    );
  });

  it('marks an estimate as one', () => {
    expect(
      expiryLabel(expiryFromDays(0, ExpiryKind.PerishableEstimate), t),
    ).toBe('≈ Expires today');
  });

  it('asks for a check on a passed long-life estimate', () => {
    expect(
      expiryLabel(expiryFromDays(-21, ExpiryKind.LongLifeEstimate), t),
    ).toBe(t('labels.expiryDueCheck'));
  });

  it.each([
    ['es', 'Caduca en 3 días', 'Caducó hace 1 día'],
    ['it', 'Scade tra 3 giorni', 'Scaduto 1 giorno fa'],
    ['sq', 'Skadon për 3 ditë', 'Skaduar 1 ditë më parë'],
  ])('%s pluralises both counted states', (locale, inThree, oneAgo) => {
    const translate: Translate = getI18n().getFixedT(locale);
    expect(expiryLabel(expiryFromDays(3, null), translate)).toBe(inThree);
    expect(expiryLabel(expiryFromDays(-1, null), translate)).toBe(oneAgo);
  });
});

describe('expiryWhen', () => {
  it.each([
    [-3, ExpiryKind.Label, '3 days ago'],
    [0, ExpiryKind.Label, 'Today'],
    [1, ExpiryKind.Label, 'Tomorrow'],
    [5, ExpiryKind.PerishableEstimate, '≈ 5 days'],
  ])('%i days away, %s, reads "%s"', (days, kind, expected) => {
    expect(expiryWhen(expiryFromDays(days, kind), t)).toBe(expected);
  });
});

describe('compareExpiry', () => {
  it('orders the earliest date first and an undated one last', () => {
    expect(
      ['2026-10-02', null, '2026-09-30', undefined, '2026-10-01'].sort(
        compareExpiry,
      ),
    ).toEqual(['2026-09-30', '2026-10-01', '2026-10-02', null, undefined]);
  });
});
