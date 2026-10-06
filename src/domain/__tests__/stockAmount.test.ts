import { UnitType } from '#/graphql/generated/schemaTypes';
import { localQuantity, stockAmountOf } from '#domain/stockAmount';

const JAR = { netWeight: 500, netWeightUnitId: 'g' };

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
    expect(
      localQuantity(
        { measured: { quantity: 750 } },
        { quantity: 2, unit: { type: UnitType.Weight } },
      ),
    ).toBe(750);
  });

  it('shows packages of a counted line as that many of it', () => {
    expect(
      localQuantity(
        { packages: { count: 3, size: JAR } },
        { quantity: 1, unit: { type: UnitType.Count } },
      ),
    ).toBe(3);
  });

  it('shows packages counted in a named unit as that many, whatever the line', () => {
    // 12 pieces on a dozen line land as 12 pieces, not 12 dozen.
    expect(
      localQuantity(
        { packages: { count: 12, unitId: 'piece' } },
        { quantity: 1, unit: { type: UnitType.Weight } },
      ),
    ).toBe(12);
  });

  it("shows a weighed line's own amount until the server converts packages", () => {
    expect(
      localQuantity(
        { packages: { count: 3, size: JAR } },
        { quantity: 1000, unit: { type: UnitType.Weight } },
      ),
    ).toBe(1000);
  });

  it('falls back to the count when the line states no amount', () => {
    expect(
      localQuantity({ packages: { count: 2 } }, { quantity: null, unit: null }),
    ).toBe(2);
  });
});
