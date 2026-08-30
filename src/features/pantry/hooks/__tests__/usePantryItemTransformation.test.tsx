'use no memo';

import {
  formatStorageState,
  calculateExpiresIn,
  getLocation,
  getExpirationStatus,
  getCategoryEmoji,
  formatPackageBreakdown,
  formatPackageBreakdownFull,
  formatNetWeight,
  formatNetWeightDisplay,
  formatRemainingNetWeight,
  formatQuantityBreakdown,
} from '../usePantryItemTransformation';
import { getI18n } from '#/i18n/config';

// The real instance (jest.setup.js initializes it), so these assertions still
// verify the copy in en.json rather than a stub's echo.
const t = getI18n().t;

describe('formatStorageState', () => {
  it('formats REFRIGERATED as Fridge', () => {
    expect(formatStorageState('REFRIGERATED', t)).toBe('Fridge');
  });
  it('formats FROZEN as Freezer', () => {
    expect(formatStorageState('FROZEN', t)).toBe('Freezer');
  });
  it('formats AMBIENT as Dry pantry', () => {
    expect(formatStorageState('AMBIENT', t)).toBe('Dry pantry');
  });
  it('formats NONE rather than leaking the raw enum', () => {
    expect(formatStorageState('NONE', t)).toBe('None');
  });
  it('returns empty string for null', () => {
    expect(formatStorageState(null, t)).toBe('');
  });
  it('returns original string for unknown state', () => {
    expect(formatStorageState('UNKNOWN', t)).toBe('UNKNOWN');
  });
});

describe('calculateExpiresIn', () => {
  it('returns null for null expiresAt', () => {
    expect(calculateExpiresIn(null)).toBeNull();
  });
  it('returns negative for past dates', () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 3);
    const result = calculateExpiresIn(pastDate.toISOString());
    expect(result).toBeLessThan(0);
  });
  it('returns positive for future dates', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const result = calculateExpiresIn(futureDate.toISOString());
    expect(result).toBeGreaterThan(0);
  });
});

describe('getLocation', () => {
  it('returns fridge for REFRIGERATED', () => {
    expect(getLocation('REFRIGERATED')).toBe('fridge');
  });
  it('returns freezer for FROZEN', () => {
    expect(getLocation('FROZEN')).toBe('freezer');
  });
  it('returns pantry for AMBIENT', () => {
    expect(getLocation('AMBIENT')).toBe('pantry');
  });
  it('returns pantry for null', () => {
    expect(getLocation(null)).toBe('pantry');
  });
});

describe('getExpirationStatus', () => {
  it('returns normal for null expiresIn', () => {
    expect(getExpirationStatus(null)).toEqual({
      text: 'No expiry date',
      type: 'normal',
    });
  });
  it('returns expired for negative days', () => {
    expect(getExpirationStatus(-3)).toEqual({
      text: 'Expired 3 days ago',
      type: 'expired',
    });
  });
  it('returns critical for today', () => {
    expect(getExpirationStatus(0)).toEqual({
      text: 'Expires today!',
      type: 'critical',
    });
  });
  it('returns warning for tomorrow', () => {
    expect(getExpirationStatus(1)).toEqual({
      text: 'Expires tomorrow!',
      type: 'warning',
    });
  });
  it('returns warning for 2-3 days', () => {
    expect(getExpirationStatus(2).type).toBe('warning');
  });
  it('returns normal for > 3 days', () => {
    expect(getExpirationStatus(10)).toEqual({
      text: '10 days left',
      type: 'normal',
    });
  });
});

describe('getCategoryEmoji', () => {
  it('returns correct emoji for known categories', () => {
    expect(getCategoryEmoji('dairy')).toBe('\uD83E\uDD5B');
    expect(getCategoryEmoji('meat')).toBe('\uD83E\uDD69');
  });
  it('returns default emoji for unknown category', () => {
    expect(getCategoryEmoji('unknown')).toBe('\uD83D\uDCE6');
  });
  it('returns default emoji for null', () => {
    expect(getCategoryEmoji(null)).toBe('\uD83D\uDCE6');
  });
  it('is case-insensitive', () => {
    expect(getCategoryEmoji('DAIRY')).toBe('\uD83E\uDD5B');
  });
});

describe('formatPackageBreakdown', () => {
  it('returns null for null breakdown', () => {
    expect(formatPackageBreakdown(null)).toBeNull();
  });
  it('formats breakdown with per-unit weight', () => {
    const result = formatPackageBreakdown({
      count: 12,
      contentUnit: { name: 'cans' },
      perUnitNetWeight: 12,
      perUnitNetWeightUnit: { symbol: 'oz' },
    });
    expect(result).toBe('12 x 12 oz cans');
  });
  it('formats breakdown without per-unit weight', () => {
    const result = formatPackageBreakdown({
      count: 6,
      contentUnit: { name: 'bottles', symbol: 'btl' },
    });
    expect(result).toBe('6 btl');
  });
  it('uses remainingContentUnits when provided', () => {
    const result = formatPackageBreakdown(
      { count: 12, contentUnit: { name: 'cans' } },
      9,
    );
    expect(result).toBe('9 cans');
  });
});

describe('formatPackageBreakdownFull', () => {
  it('returns null for null breakdown', () => {
    expect(formatPackageBreakdownFull(null)).toBeNull();
  });
  it('appends total when available', () => {
    const result = formatPackageBreakdownFull({
      count: 12,
      contentUnit: { name: 'cans' },
      perUnitNetWeight: 12,
      perUnitNetWeightUnit: { symbol: 'oz' },
      totalNetWeight: 144,
    });
    expect(result).toBe('12 x 12 oz cans (144 oz total)');
  });
});

describe('formatNetWeight', () => {
  it('returns null for no weight', () => {
    expect(formatNetWeight(null)).toBeNull();
  });
  it('formats with unit symbol', () => {
    expect(formatNetWeight(14.5, { symbol: 'oz' })).toBe('14.5oz ea');
  });
});

describe('formatNetWeightDisplay', () => {
  it('returns null for no weight', () => {
    expect(formatNetWeightDisplay(null)).toBeNull();
  });
  it('upscales g to kg when >= 1000', () => {
    expect(formatNetWeightDisplay(1500, { symbol: 'g' })).toBe('1.5 kg');
  });
  it('upscales ml to L when >= 1000', () => {
    expect(formatNetWeightDisplay(2000, { symbol: 'ml' })).toBe('2.0 L');
  });
  it('formats integer values', () => {
    expect(formatNetWeightDisplay(500, { symbol: 'g' })).toBe('500 g');
  });
});

describe('formatRemainingNetWeight', () => {
  it('returns null for null remaining', () => {
    expect(formatRemainingNetWeight(null)).toBeNull();
  });
  it('formats remaining weight', () => {
    expect(formatRemainingNetWeight(25, { symbol: 'oz' })).toBe(
      '25 oz remaining',
    );
  });
});

describe('formatQuantityBreakdown', () => {
  it('returns null for null breakdown', () => {
    expect(formatQuantityBreakdown(null)).toBeNull();
  });
  it('returns null when total is 0', () => {
    const result = formatQuantityBreakdown({
      fullPackages: 0,
      looseContentUnits: 0,
      totalContentUnits: 0,
    });
    expect(result).toBeNull();
  });
  it('renders the unit label the server gave, without pluralising it', () => {
    // Appending a literal "s" for any count but 1 is English pluralisation
    // applied to a label that is not English — "2 lattinas" in Italian — and it
    // is wrong even in English the moment the unit is a symbol: "15 kgs".
    //
    // `Unit.symbol` is non-null in the schema and is preferred here, so the
    // symbol is what renders in practice, and symbols are not pluralised
    // ("15 kg"). Pluralising the `name` fallback correctly would need a plural
    // form per unit per language, which the API does not expose — see the note
    // in `formatQuantityBreakdown`.
    const result = formatQuantityBreakdown({
      fullPackages: 1,
      looseContentUnits: 3,
      contentUnit: { name: 'can', symbol: 'can' },
      totalContentUnits: 15,
    });
    expect(result).toBe('15 can');
  });
  it('handles singular unit', () => {
    const result = formatQuantityBreakdown({
      fullPackages: 0,
      looseContentUnits: 1,
      contentUnit: { name: 'bottle' },
      totalContentUnits: 1,
    });
    expect(result).toBe('1 bottle');
  });
});
