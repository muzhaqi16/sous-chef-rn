'use no memo';

import {
  formatStorageState,
  getExpirationStatus,
  formatPackageBreakdown,
  formatPackageBreakdownFull,
  formatNetWeightDisplay,
  formatQuantityBreakdown,
} from '../usePantryItemTransformation';
import { getI18n } from '#/i18n/config';
import { StorageState } from '#/graphql/generated/schemaTypes';

// The real instance (jest.setup.js initializes it), so these assertions still
// verify the copy in en.json rather than a stub's echo.
const t = getI18n().t;

describe('formatStorageState', () => {
  it('formats REFRIGERATED as Fridge', () => {
    expect(formatStorageState(StorageState.Refrigerated, t)).toBe('Fridge');
  });
  it('formats FROZEN as Freezer', () => {
    expect(formatStorageState(StorageState.Frozen, t)).toBe('Freezer');
  });
  it('formats AMBIENT as Dry pantry', () => {
    expect(formatStorageState(StorageState.Ambient, t)).toBe('Dry pantry');
  });
  it('formats NONE rather than leaking the raw enum', () => {
    expect(formatStorageState(StorageState.None, t)).toBe('None');
  });
  it('returns empty string for null', () => {
    expect(formatStorageState(null, t)).toBe('');
  });
  it('labels a member newer than the codegen enum as unknown, never raw', () => {
    // Arrives as wire JSON, which the generated enum cannot describe.
    const newerMember: StorageState = JSON.parse('"CRYOGENIC"');
    expect(formatStorageState(newerMember, t)).toBe('Unknown');
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
  it('writes a fractional per-unit weight as a decimal', () => {
    const result = formatPackageBreakdown({
      count: 4,
      contentUnit: { name: 'cans' },
      perUnitNetWeight: 14.5,
      perUnitNetWeightUnit: { symbol: 'oz' },
    });
    expect(result).toBe('4 x 14.5 oz cans');
  });
  it('formats breakdown without per-unit weight', () => {
    const result = formatPackageBreakdown({
      count: 6,
      contentUnit: { name: 'bottles', symbol: 'btl' },
    });
    expect(result).toBe('6 btl');
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
