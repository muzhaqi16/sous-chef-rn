import { UnitType } from '#/graphql/generated/schemaTypes';
import {
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
