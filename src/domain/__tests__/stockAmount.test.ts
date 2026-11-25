import { UnitType } from '#graphql/generated/schemaTypes';
import {
  boughtAmountOf,
  contentsOf,
  restockContentsOf,
  localQuantity,
  packagesNeedSizing,
  stockAmountOf,
  takesContents,
} from '#domain/stockAmount';

const JAR = { netWeight: 500, netWeightUnitId: 'g' };

describe('boughtAmountOf', () => {
  const PIECE = { id: 'piece', type: UnitType.Count };
  const ML = { id: 'ml', type: UnitType.Volume };

  it('counts it in the counted stack the pantry holds', () => {
    expect(boughtAmountOf(1, { heldUnit: PIECE })).toStrictEqual({
      measured: { quantity: 1, unitId: 'piece' },
    });
  });

  it('states packages for a stack held by weight or volume, never an amount', () => {
    expect(boughtAmountOf(1, { heldUnit: ML })).toStrictEqual({
      packages: { count: 1 },
    });
  });

  it('states packages when the pantry holds none', () => {
    expect(boughtAmountOf(2)).toStrictEqual({ packages: { count: 2 } });
    expect(boughtAmountOf(2, { heldUnit: null })).toStrictEqual({
      packages: { count: 2 },
    });
  });

  it('states packages of a known size, whatever the stack', () => {
    expect(boughtAmountOf(1, { heldUnit: ML, packageSize: JAR })).toStrictEqual(
      { packages: { count: 1, size: JAR } },
    );
    expect(
      boughtAmountOf(1, { heldUnit: PIECE, packageSize: JAR }),
    ).toStrictEqual({ packages: { count: 1, size: JAR } });
  });

  it("counts in a counted stack's own unit when the buyer names it", () => {
    expect(
      boughtAmountOf(2, { heldUnit: PIECE, unitId: 'piece' }),
    ).toStrictEqual({ measured: { quantity: 2, unitId: 'piece' } });
  });

  // The API restates it into the stack, or a forced add keeps it apart.
  it("states packages in the buyer's unit wherever the stack can take it", () => {
    const unitId = 'jar';
    expect(boughtAmountOf(2, { heldUnit: PIECE, unitId })).toStrictEqual({
      packages: { count: 2, unitId },
    });
    expect(
      boughtAmountOf(2, { heldUnit: PIECE, packageSize: JAR, unitId }),
    ).toStrictEqual({ packages: { count: 2, size: JAR, unitId } });
    expect(boughtAmountOf(2, { heldUnit: ML, unitId })).toStrictEqual({
      packages: { count: 2, unitId },
    });
    expect(boughtAmountOf(2, { heldUnit: null, unitId })).toStrictEqual({
      packages: { count: 2, unitId },
    });
  });

  // The API refuses a package unit on a stack held by weight or volume.
  it('names no unit on sized packages for a stack not counted', () => {
    expect(
      boughtAmountOf(2, { heldUnit: ML, packageSize: JAR, unitId: 'jar' }),
    ).toStrictEqual({ packages: { count: 2, size: JAR } });
  });

  it('never states a measured amount for a weighed or volume stack', () => {
    for (const type of [UnitType.Weight, UnitType.Volume]) {
      expect(
        boughtAmountOf(3, { heldUnit: { id: 'u', type } }).measured,
      ).toBeUndefined();
    }
  });
});

describe('stockAmountOf', () => {
  it('states an amount in the unit given', () => {
    expect(stockAmountOf(2, { unitId: 'kg' })).toEqual({
      measured: { quantity: 2, unitId: 'kg' },
    });
  });

  it("leaves the unit to the write's default when none is given", () => {
    expect(stockAmountOf(2, { unitId: null })).toStrictEqual({
      measured: { quantity: 2 },
    });
    expect(stockAmountOf(1)).toStrictEqual({ measured: { quantity: 1 } });
  });

  it('states packages of the size given, in the counted unit given', () => {
    expect(
      stockAmountOf(3, { asPackages: true, packageSize: JAR, unitId: 'jar' }),
    ).toStrictEqual({ packages: { count: 3, size: JAR, unitId: 'jar' } });
  });

  it("leaves the package size to the API's own when none is given", () => {
    expect(stockAmountOf(3, { asPackages: true })).toStrictEqual({
      packages: { count: 3 },
    });
  });

  it('ignores a size the caller does not record as packages', () => {
    expect(
      stockAmountOf(1.5, { asPackages: false, packageSize: JAR }),
    ).toStrictEqual({ measured: { quantity: 1.5 } });
  });
});

describe('localQuantity', () => {
  it('shows a measured amount as stated', () => {
    expect(localQuantity({ measured: { quantity: 750 } })).toBe(750);
  });

  it('shows packages as their count, never a requested amount', () => {
    // A receipt's "3 @" on "Flour 1000 g": the server sizes the packages, so
    // the row must not show 1000 g as if it were what was bought.
    expect(localQuantity({ packages: { count: 3, size: JAR } })).toBe(3);
  });
});

describe('packagesNeedSizing', () => {
  it('leaves a measured amount to the device', () => {
    expect(
      packagesNeedSizing(
        { measured: { quantity: 2 } },
        { unit: { type: UnitType.Weight } },
      ),
    ).toBe(false);
  });

  it('leaves packages of a counted line to the device: the server counts them', () => {
    expect(
      packagesNeedSizing(
        { packages: { count: 2 } },
        { unit: { type: UnitType.Count } },
      ),
    ).toBe(false);
  });

  it('leaves packages counted in a named unit to the device', () => {
    // 12 pieces on a weighed line land as 12 pieces.
    expect(
      packagesNeedSizing(
        { packages: { count: 12, unitId: 'piece' } },
        { unit: { type: UnitType.Weight } },
      ),
    ).toBe(false);
  });

  it('hands packages of a weighed line to the server', () => {
    expect(
      packagesNeedSizing(
        { packages: { count: 2 } },
        { unit: { type: UnitType.Weight } },
      ),
    ).toBe(true);
  });

  it('hands packages of a line with no unit to the server', () => {
    expect(packagesNeedSizing({ packages: { count: 1 } }, { unit: null })).toBe(
      true,
    );
  });
});

describe('contentsOf', () => {
  it('states nothing when nothing was stated', () => {
    expect(contentsOf(null)).toStrictEqual({ packageSize: null });
  });

  it('states a measure as the package size', () => {
    expect(
      contentsOf({ amount: 5, unitId: 'lb', unitType: UnitType.Weight }),
    ).toStrictEqual({
      packageSize: { netWeight: 5, netWeightUnitId: 'lb' },
    });
  });

  it('reads a unit of unknown kind as a measure, which the server can refuse', () => {
    expect(
      contentsOf({ amount: 5, unitId: 'x', unitType: null }),
    ).toStrictEqual({ packageSize: { netWeight: 5, netWeightUnitId: 'x' } });
  });

  it('states a count as a portion definition', () => {
    expect(
      contentsOf({ amount: 10, unitId: 'can', unitType: UnitType.Count }),
    ).toStrictEqual({
      packageSize: null,
      measurementProfile: { portionUnitId: 'can', portionsPerTrackingUnit: 10 },
    });
  });
});

describe('restockContentsOf', () => {
  const CAN = { amount: 12, unitId: 'can', unitType: UnitType.Count };

  it('sizes the new packages with a measure', () => {
    expect(
      restockContentsOf(
        { amount: 3, unitId: 'lb', unitType: UnitType.Weight },
        null,
      ),
    ).toStrictEqual({
      packageSize: { netWeight: 3, netWeightUnitId: 'lb' },
    });
  });

  it('keeps a count in the stack’s own portion unit on the batch', () => {
    expect(restockContentsOf(CAN, 'can')).toStrictEqual({
      packageSize: null,
      packagePortions: 12,
    });
  });

  it('defines the stack with a count it has no portion unit for', () => {
    expect(restockContentsOf(CAN, null)).toStrictEqual({
      packageSize: null,
      measurementProfile: { portionUnitId: 'can', portionsPerTrackingUnit: 12 },
    });
  });
});

describe('takesContents', () => {
  it('holds for a count, and for a unit not yet known', () => {
    expect(takesContents(UnitType.Count)).toBe(true);
    expect(takesContents(null)).toBe(true);
  });

  it('never holds for a measure', () => {
    expect(takesContents(UnitType.Weight)).toBe(false);
    expect(takesContents(UnitType.Volume)).toBe(false);
  });
});
