'use no memo';

import {
  formatStorageState,
  getExpirationStatus,
  formatHeldAmount,
  formatPackageBreakdown,
  formatPackageBreakdownFull,
  formatQuantityBreakdown,
} from '../usePantryItemTransformation';
import { getI18n } from '#/i18n/config';
import {
  StorageState,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';

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
    expect(getExpirationStatus(null, t)).toEqual({
      text: 'No expiry date',
      type: 'normal',
    });
  });
  it('returns expired for negative days', () => {
    expect(getExpirationStatus(-3, t)).toEqual({
      text: 'Expired 3 days ago',
      type: 'expired',
    });
  });
  it('returns critical for today', () => {
    expect(getExpirationStatus(0, t)).toEqual({
      text: 'Expires today',
      type: 'critical',
    });
  });
  it('returns warning for tomorrow', () => {
    expect(getExpirationStatus(1, t)).toEqual({
      text: 'Expires tomorrow',
      type: 'warning',
    });
  });
  it('returns warning for 2-3 days', () => {
    expect(getExpirationStatus(2, t).type).toBe('warning');
  });
  it('returns normal for > 3 days', () => {
    expect(getExpirationStatus(10, t)).toEqual({
      text: 'Expires in 10 days',
      type: 'normal',
    });
  });
});

describe('formatPackageBreakdown', () => {
  it('returns null for null breakdown', () => {
    expect(formatPackageBreakdown(null, t)).toBeNull();
  });
  it('formats breakdown with per-unit weight', () => {
    const result = formatPackageBreakdown(
      {
        count: 12,
        contentUnit: { name: 'cans' },
        perUnitNetWeight: 12,
        perUnitNetWeightUnit: { symbol: 'oz' },
      },
      t,
    );
    expect(result).toBe('12 x 12 oz cans');
  });
  it('writes a fractional per-unit weight as a decimal', () => {
    const result = formatPackageBreakdown(
      {
        count: 4,
        contentUnit: { name: 'cans' },
        perUnitNetWeight: 14.5,
        perUnitNetWeightUnit: { symbol: 'oz' },
      },
      t,
    );
    expect(result).toBe('4 x 14.5 oz cans');
  });
  it('formats breakdown without per-unit weight', () => {
    const result = formatPackageBreakdown(
      {
        count: 6,
        contentUnit: { name: 'bottles', symbol: 'btl' },
      },
      t,
    );
    expect(result).toBe('6 btl');
  });
});

describe('formatPackageBreakdownFull', () => {
  it('returns null for null breakdown', () => {
    expect(formatPackageBreakdownFull(null, t)).toBeNull();
  });
  it('appends total when available', () => {
    const result = formatPackageBreakdownFull(
      {
        count: 12,
        contentUnit: { name: 'cans' },
        perUnitNetWeight: 12,
        perUnitNetWeightUnit: { symbol: 'oz' },
        totalNetWeight: 144,
      },
      t,
    );
    expect(result).toBe('12 x 12 oz cans (144 oz total)');
  });

  // 12 cans of 340.19 g, stored in grams: an imperial reader sees ounces.
  describe('in the user’s unit system', () => {
    const reading = (value: number, unitId: string, symbol: string) => ({
      value,
      unitId,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });
    const measure = (value: number, metric: number, imperial: number) => ({
      value,
      unitId: 'unit-g',
      metric: reading(metric, 'unit-g', 'g'),
      imperial: reading(imperial, 'unit-oz', 'oz'),
    });
    const cans = {
      count: 12,
      contentUnit: { name: 'cans' },
      perUnitNetWeight: 340.19,
      perUnitNetWeightUnit: { id: 'unit-g', symbol: 'g' },
      totalNetWeight: 4082.28,
      perUnit: measure(340.19, 340.19, 12),
      total: measure(4082.28, 4082.28, 144),
    };

    it('reads each weight in ounces for an imperial reader', () => {
      expect(formatPackageBreakdownFull(cans, t, UnitSystem.Imperial)).toBe(
        '12 x 12 oz cans (144 oz total)',
      );
    });

    it('reads each weight in grams for a metric reader', () => {
      expect(formatPackageBreakdownFull(cans, t, UnitSystem.Metric)).toBe(
        '12 x 340.19 g cans (4082.28 g total)',
      );
    });

    // A local write moved the stored figure; only the server can re-read it.
    it('shows a weight as stored once its reading no longer describes it', () => {
      expect(
        formatPackageBreakdownFull(
          { ...cans, perUnitNetWeight: 300, totalNetWeight: 3600 },
          t,
          UnitSystem.Imperial,
        ),
      ).toBe('12 x 300 g cans (3600 g total)');
    });
  });
});

describe('formatHeldAmount', () => {
  const NO_READING = {
    value: 0,
    unitId: 'unit-none',
    metric: { value: 0, unitId: 'unit-none', symbol: '' },
    imperial: { value: 0, unitId: 'unit-none', symbol: '' },
  };
  const liters = (quantity: number, fraction: string | null = null) => ({
    displayAmount: { quantity, fraction, unit: { id: 'u-l', symbol: 'L' } },
    held: NO_READING,
  });

  it('reads it in the user’s system while the reading describes it', () => {
    const weighed = {
      displayAmount: { quantity: 100, unit: { id: 'u-g', symbol: 'g' } },
      held: {
        value: 100,
        unitId: 'u-g',
        metric: {
          value: 100,
          unitId: 'u-g',
          symbol: 'g',
          displayAsFraction: false,
          type: UnitType.Weight,
        },
        imperial: {
          value: 3.5,
          unitId: 'u-oz',
          symbol: 'oz',
          displayAsFraction: false,
          type: UnitType.Weight,
        },
      },
    };
    expect(formatHeldAmount(weighed, UnitSystem.Imperial)).toBe('3.5 oz');
  });

  it('shows a stack as the server shows it: 12 pc as 1 doz', () => {
    expect(
      formatHeldAmount(
        {
          displayAmount: { quantity: 1, unit: { id: 'u-doz', symbol: 'doz' } },
          held: NO_READING,
        },
        UnitSystem.Metric,
      ),
    ).toBe('1 doz');
  });

  it('writes a fraction where the server shows one, else a number', () => {
    expect(formatHeldAmount(liters(1.25, '¼'), UnitSystem.Metric)).toBe(
      '1 1/4 L',
    );
    expect(formatHeldAmount(liters(1.25), UnitSystem.Metric)).toBe('1.25 L');
  });

  // The short form an Italian reader sees is a name, and agrees with the count.
  it('shows the unit in the app language, singular or plural by the amount', () => {
    const cans = (quantity: number) => ({
      displayAmount: {
        quantity,
        fraction: null,
        unit: {
          id: 'u-can',
          symbol: 'can',
          localizedSymbolForms: { one: 'lattina', other: 'lattine' },
        },
      },
      held: NO_READING,
    });
    expect(formatHeldAmount(cans(3), UnitSystem.Metric)).toBe('3 lattine');
    expect(formatHeldAmount(cans(1), UnitSystem.Metric)).toBe('1 lattina');
    // A part of one reads singular only as a fraction.
    expect(formatHeldAmount(cans(0.5), UnitSystem.Metric)).toBe('0.5 lattine');
    expect(
      formatHeldAmount(
        {
          ...cans(0.5),
          displayAmount: { ...cans(0.5).displayAmount, fraction: '½' },
        },
        UnitSystem.Metric,
      ),
    ).toBe('1/2 lattina');
  });

  it('rounds to three decimals for a unit that does not', () => {
    expect(formatHeldAmount(liters(177.4412), UnitSystem.Metric)).toBe(
      '177.441 L',
    );
  });
});

describe('formatQuantityBreakdown', () => {
  it('returns null for null breakdown', () => {
    expect(formatQuantityBreakdown(null, t)).toBeNull();
  });
  it('returns null when total is 0', () => {
    const result = formatQuantityBreakdown(
      {
        fullPackages: 0,
        looseContentUnits: 0,
        totalContentUnits: 0,
      },
      t,
    );
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
    const result = formatQuantityBreakdown(
      {
        fullPackages: 1,
        looseContentUnits: 3,
        contentUnit: { name: 'can', symbol: 'can' },
        totalContentUnits: 15,
      },
      t,
    );
    expect(result).toBe('15 can');
  });
  it('handles singular unit', () => {
    const result = formatQuantityBreakdown(
      {
        fullPackages: 0,
        looseContentUnits: 1,
        contentUnit: { name: 'bottle' },
        totalContentUnits: 1,
      },
      t,
    );
    expect(result).toBe('1 bottle');
  });
});
