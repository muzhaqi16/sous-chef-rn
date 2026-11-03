'use no memo';

import {
  formatStorageState,
  getExpirationStatus,
  formatAmountLeft,
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

describe('formatAmountLeft', () => {
  const reading = (
    value: number,
    symbol: string,
    type: UnitType = UnitType.Count,
    displayAsFraction = false,
  ) => ({ value, unitId: `u-${symbol}`, symbol, type, displayAsFraction });
  const left = (metric: ReturnType<typeof reading>, imperial = metric) => ({
    amountLeft: { metric, imperial },
  });

  it('reads it in the user’s system', () => {
    const honey = left(
      reading(100, 'g', UnitType.Weight),
      reading(3.5, 'oz', UnitType.Weight),
    );
    expect(formatAmountLeft(honey, UnitSystem.Imperial)).toBe('3.5 oz');
    expect(formatAmountLeft(honey, UnitSystem.Metric)).toBe('100 g');
  });

  it.each([
    ['2 bags', reading(2, 'bags')],
    ['1 doz', reading(1, 'doz')],
    ['9 cans', reading(9, 'cans')],
    ['1 lb', reading(1, 'lb', UnitType.Weight)],
    ['1/2 box', reading(0.5, 'box')],
    ['2 1/4 box', reading(2.25, 'box')],
    ['1 1/4 L', reading(1.25, 'L', UnitType.Volume, true)],
    ['1.25 L', reading(1.25, 'L', UnitType.Volume)],
    ['177.441 L', reading(177.4412, 'L', UnitType.Volume)],
  ])('reads %s', (text, amount) => {
    expect(formatAmountLeft(left(amount), UnitSystem.Metric)).toBe(text);
  });

  // The short form an Italian reader sees is a name, and agrees with the count.
  it('takes the unit in the app language from the reading', () => {
    const cans = {
      ...reading(9, 'can'),
      localizedSymbol: 'lattine',
    };
    expect(formatAmountLeft(left(cans), UnitSystem.Metric)).toBe('9 lattine');
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
