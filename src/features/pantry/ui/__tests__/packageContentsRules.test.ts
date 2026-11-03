import { UnitType } from '#/graphql/generated/schemaTypes';
import {
  statedContents,
  type PackageContentsValues,
} from '#domain/stockAmount';
import { isPickedWhenSized, isWholeWhenSized } from '../packageContentsRules';

const nothingStated: PackageContentsValues = {
  unitType: UnitType.Count,
  sizeInput: '',
  sizeUnitDisplay: '',
  sizeUnitId: null,
  sizeUnitType: null,
};

const fiveLb: PackageContentsValues = {
  ...nothingStated,
  sizeInput: '5',
  sizeUnitDisplay: 'lb',
  sizeUnitId: 'unit-lb',
  sizeUnitType: UnitType.Weight,
};

describe('statedContents', () => {
  it('reads what a package holds', () => {
    expect(statedContents(fiveLb)).toEqual({
      amount: 5,
      unitId: 'unit-lb',
      unitType: UnitType.Weight,
    });
  });

  it('reads a count the same way', () => {
    expect(
      statedContents({
        ...nothingStated,
        sizeInput: '10',
        sizeUnitId: 'unit-can',
        sizeUnitType: UnitType.Count,
      }),
    ).toEqual({ amount: 10, unitId: 'unit-can', unitType: UnitType.Count });
  });

  it('reads nothing when no size is stated', () => {
    expect(statedContents(nothingStated)).toBeNull();
  });

  it('reads nothing for a measure, which offers no contents', () => {
    expect(statedContents({ ...fiveLb, unitType: UnitType.Weight })).toBeNull();
  });
});

describe('the rules', () => {
  it('asks a stated size for its unit', () => {
    expect(isPickedWhenSized(null, UnitType.Count, '5')).toBe(false);
    expect(isPickedWhenSized('unit-lb', UnitType.Count, '5')).toBe(true);
  });

  it('asks nothing of a size not stated, or left behind on a measure', () => {
    expect(isPickedWhenSized(null, UnitType.Count, '')).toBe(true);
    expect(isPickedWhenSized(null, UnitType.Weight, '5')).toBe(true);
  });

  it('counts packages whole once a size is stated', () => {
    expect(isWholeWhenSized('1 1/2', UnitType.Count, '5')).toBe(false);
    expect(isWholeWhenSized('2', UnitType.Count, '5')).toBe(true);
  });

  it('takes a part of a count with nothing stated inside', () => {
    expect(isWholeWhenSized('1 1/2', UnitType.Count, '')).toBe(true);
  });

  it('takes a part of a measure', () => {
    expect(isWholeWhenSized('1 1/2', UnitType.Weight, '5')).toBe(true);
  });
});
