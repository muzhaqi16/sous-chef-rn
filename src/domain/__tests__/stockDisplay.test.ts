import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  amountLeftOf,
  countFactorOver,
  inCountedUnit,
  shownStock,
  type DisplayUnitShape,
} from '#domain/stockDisplay';

const PIECE = { id: 'pc', symbol: 'pc' };
const DOZEN: DisplayUnitShape = {
  id: 'doz',
  symbol: 'doz',
  type: UnitType.Count,
  hasStandardCountFactor: true,
  baseUnitId: 'pc',
  conversionFactor: 12,
  commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
};

const shown = (held: number, displayUnit: DisplayUnitShape | null = DOZEN) => {
  const amount = shownStock(held, PIECE, displayUnit);
  return `${amount.quantity} ${amount.unit.symbol}`;
};

describe('shownStock', () => {
  it('shows whole dozens and common fractions of one in dozens', () => {
    expect(shown(36)).toBe('3 doz');
    expect(shown(33)).toBe('2.75 doz');
    expect(shown(32)).toBe(`${32 / 12} doz`);
    expect(shown(6)).toBe('0.5 doz');
    expect(shown(3)).toBe('0.25 doz');
  });

  it('shows any other count in pieces, never a decimal of a dozen', () => {
    for (const held of [1, 5, 7, 10, 11, 25, 34, 35]) {
      expect(shown(held)).toBe(`${held} pc`);
    }
  });

  it('shows in pieces what is not a whole count', () => {
    expect(shown(11.5)).toBe('11.5 pc');
  });

  it('reads a count within float noise of whole as whole', () => {
    expect(shown(36.0000000004)).toBe('3 doz');
  });

  it('shows an empty stack in its own unit', () => {
    expect(shown(0)).toBe('0 pc');
  });

  it('falls back to the default fractions when the dozen states none; an eighth is no whole piece', () => {
    const dozen = { ...DOZEN, commonFractions: null };
    expect(shown(9, dozen)).toBe('0.75 doz');
    // ⅛ of a dozen is 1.5 pieces; 2 pieces is ⅙, which no default names.
    expect(shown(2, dozen)).toBe('2 pc');
  });

  it('keeps only the fractions the dozen lists', () => {
    expect(shown(4, { ...DOZEN, commonFractions: [1 / 2] })).toBe('4 pc');
  });

  it('shows the unit it counts in without a display unit', () => {
    expect(shown(24, null)).toBe('24 pc');
  });

  it('ignores a display unit that is no dozen of the unit it counts in', () => {
    expect(shown(24, { ...DOZEN, baseUnitId: 'item' })).toBe('24 pc');
    expect(shown(24, { ...DOZEN, hasStandardCountFactor: false })).toBe(
      '24 pc',
    );
    expect(shown(24, { ...DOZEN, type: UnitType.Volume })).toBe('24 pc');
  });
});

describe('countFactorOver', () => {
  it('is the factor of a dozen over the pieces it counts', () => {
    expect(countFactorOver(DOZEN, 'pc')).toBe(12);
  });

  it('is null over any other unit, or none', () => {
    expect(countFactorOver(DOZEN, 'g')).toBeNull();
    expect(countFactorOver(DOZEN, undefined)).toBeNull();
    expect(
      countFactorOver({ ...DOZEN, baseUnitId: undefined }, undefined),
    ).toBeNull();
  });

  it('is null for a synonym of the base (factor 1)', () => {
    expect(countFactorOver({ ...DOZEN, conversionFactor: 1 }, 'pc')).toBeNull();
  });
});

describe('inCountedUnit', () => {
  it('passes an amount in the unit itself through', () => {
    expect(inCountedUnit(0.9995, 1)).toBe(0.9995);
  });

  it('reads a fraction of a dozen typed to three decimals as the count it names', () => {
    expect(inCountedUnit(0.333, 12)).toBe(4);
    expect(inCountedUnit(0.917, 12)).toBe(11);
    expect(inCountedUnit(2 + 1 / 12, 12)).toBe(25);
  });

  it('keeps a count off a whole by more than a typed step as meant', () => {
    expect(inCountedUnit(0.08, 12)).toBeCloseTo(0.96);
  });
});

describe('amountLeftOf', () => {
  const BAG = { id: 'bag', symbol: 'bag' };
  const CAN = { id: 'can', symbol: 'can' };
  const LB = { id: 'lb', symbol: 'lb' };
  const read = (
    held: number,
    contents: Partial<Parameters<typeof amountLeftOf>[0]> = {},
  ) =>
    amountLeftOf({
      held,
      shown: { quantity: held, unit: BAG },
      trackingType: UnitType.Count,
      ...contents,
    });

  it('reads whole packages as the stack shows them', () => {
    expect(read(2)).toStrictEqual({ quantity: 2, unit: BAG });
  });

  it('reads whole pieces in the dozen the stack shows', () => {
    expect(
      amountLeftOf({
        held: 24,
        shown: shownStock(24, PIECE, DOZEN),
        trackingType: UnitType.Count,
      }),
    ).toStrictEqual({ quantity: 2, unit: DOZEN });
  });

  it('keeps a whole case a case, whatever is inside', () => {
    expect(read(1, { portions: { left: 10, unit: CAN } })).toMatchObject({
      quantity: 1,
      unit: BAG,
    });
  });

  it('reads an opened bag by what is left in it', () => {
    expect(read(0.2, { netWeight: { left: 1, unit: LB } })).toStrictEqual({
      quantity: 1,
      unit: LB,
    });
  });

  it.each([
    [0.9, 9],
    [1.7, 17],
    [0.95, 9.5],
  ])('reads %d cases of 10 as %d cans', (held, left) => {
    expect(read(held, { portions: { left, unit: CAN } })).toStrictEqual({
      quantity: left,
      unit: CAN,
    });
  });

  it('takes portions over a net weight', () => {
    expect(
      read(0.9, {
        portions: { left: 9, unit: CAN },
        netWeight: { left: 67.5, unit: LB },
      }),
    ).toMatchObject({ unit: CAN });
  });

  it.each([
    [0.5, 0.5],
    [0.37, 1 / 3],
    [0.02, 0.125],
    [0.99, 0.75],
    [2.26, 2.25],
  ])('reads %d of a box of nothing stated as %d', (held, quantity) => {
    expect(read(held)).toStrictEqual({ quantity, unit: BAG });
  });

  it('reads the fractions a unit states', () => {
    expect(read(0.4, { commonFractions: [0.25, 0.75] })).toMatchObject({
      quantity: 0.25,
    });
  });

  it.each([UnitType.Weight, UnitType.Volume])(
    'reads a stack counted in %s as held: it has no package to part-use',
    trackingType => {
      expect(
        amountLeftOf({
          held: 380.5,
          shown: { quantity: 380.5, unit: LB },
          trackingType,
        }),
      ).toStrictEqual({ quantity: 380.5, unit: LB });
    },
  );
});
