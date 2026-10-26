import type { ValidationError } from 'yup';
import {
  NetWeightKind,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import type { ScannedItem } from '#features/barcode/types';
import {
  packageUnitOf,
  scanAmountDefaults,
  scanAmountOf,
  scanAmountSchema,
  type ScanAmountFormValues,
} from '../scanAmountFormConfig';

const piece = { id: 'unit-pc', symbol: 'pc', type: UnitType.Count };
const jar = { id: 'unit-jar', symbol: 'jar', type: UnitType.Count };
const cup = { id: 'unit-cup', symbol: 'cup', type: UnitType.Volume };
type PackageSize = NonNullable<ScannedItem['packageSize']>;
const reading = (
  value: number,
  id: string,
  symbol: string,
): PackageSize['metric'] => ({
  __typename: 'MeasureReading',
  value,
  unit: {
    __typename: 'Unit',
    id,
    symbol,
    displayAsFraction: false,
    type: UnitType.Weight,
  },
});

const honey: ScannedItem = {
  id: 'item-honey',
  conceptIds: [],
  name: 'Raw Unfiltered Honey',
  upc: '096619222698',
  canEdit: false,
  canSuggest: true,
  netWeight: 1360.78,
  netWeightKind: NetWeightKind.Package,
  displayUnit: { id: 'unit-g', name: 'gram', symbol: 'g' },
  packageSize: {
    __typename: 'Measure',
    value: 1360.78,
    unit: { __typename: 'Unit', id: 'unit-g' },
    metric: reading(1.36, 'unit-kg', 'kg'),
    imperial: reading(3, 'unit-lb', 'lb'),
  },
};

describe('the package a scan is counted in', () => {
  it('joins the counted stack the pantry already holds', () => {
    expect(
      packageUnitOf(honey, { id: 'unit-jar', type: UnitType.Count }, [
        piece,
        jar,
      ]),
    ).toEqual(jar);
  });

  it('takes a counted tracking unit next', () => {
    expect(
      packageUnitOf({ ...honey, trackingUnit: { ...jar, name: 'jar' } }, null, [
        piece,
      ]),
    ).toMatchObject({ id: 'unit-jar' });
  });

  // A can whose tracking unit is a cup would land as "1 cup".
  it('never counts a package in a measure: a piece instead', () => {
    expect(
      packageUnitOf(
        { ...honey, trackingUnit: { ...cup, name: 'cup' } },
        { id: 'unit-cup', type: UnitType.Volume },
        [piece, cup],
      ),
    ).toEqual(piece);
  });

  it('has none to offer when the device holds no counting unit', () => {
    expect(packageUnitOf(honey, null, [cup])).toBeNull();
  });
});

describe('the amount a scan prefills', () => {
  it('is one package holding the pack size in the user’s unit system', () => {
    expect(scanAmountDefaults(honey, jar, UnitSystem.Imperial)).toEqual({
      packaged: true,
      quantityInput: '1',
      unitDisplay: 'jar',
      unitId: 'unit-jar',
      unitType: UnitType.Count,
      sizeInput: '3',
      sizeUnitDisplay: 'lb',
      sizeUnitId: 'unit-lb',
      // Nothing suggests one yet, so it starts empty.
      consumeUnitDisplay: '',
      consumeUnitId: null,
    });
    expect(scanAmountDefaults(honey, jar, UnitSystem.Metric)).toMatchObject({
      sizeInput: '1.36',
      sizeUnitDisplay: 'kg',
      sizeUnitId: 'unit-kg',
    });
  });

  it('leaves the size empty when the record states no package size', () => {
    const unsized = { ...honey, packageSize: undefined };
    expect(
      scanAmountDefaults(
        { ...unsized, netWeightKind: NetWeightKind.Serving },
        piece,
        UnitSystem.Imperial,
      ),
    ).toMatchObject({ sizeInput: '', sizeUnitId: null });
  });
});

describe('the amount schema', () => {
  const filled = scanAmountDefaults(honey, jar, UnitSystem.Imperial);

  const pathOf = async (values: ScanAmountFormValues) => {
    const error = await scanAmountSchema
      .validate(values)
      .catch((e: ValidationError) => e);
    return (error as ValidationError).path;
  };

  it('accepts the prefill', async () => {
    await expect(scanAmountSchema.validate(filled)).resolves.toBeTruthy();
  });

  it.each([
    ['quantityInput', { quantityInput: '0' }],
    ['quantityInput', { quantityInput: '1 1/2' }],
    ['unitId', { unitId: null }],
    ['unitId', { unitId: 'unit-cup', unitType: UnitType.Volume }],
    ['sizeInput', { sizeInput: '0' }],
    ['sizeUnitId', { sizeUnitId: null }],
    ['consumeUnitId', { consumeUnitDisplay: 'tbs', consumeUnitId: null }],
  ])('reports a bad %s on that field', async (path, override) => {
    expect(await pathOf({ ...filled, ...override })).toBe(path);
  });

  it('takes a package with no size', async () => {
    await expect(
      scanAmountSchema.validate({
        ...filled,
        sizeInput: '',
        sizeUnitId: null,
        sizeUnitDisplay: '',
      }),
    ).resolves.toBeTruthy();
  });

  // Not packaged, it is an amount: any unit, and any part of one.
  it('takes a fraction of a measure when not packaged', async () => {
    await expect(
      scanAmountSchema.validate({
        ...filled,
        packaged: false,
        quantityInput: '1 1/2',
        unitId: 'unit-cup',
        unitType: UnitType.Volume,
      }),
    ).resolves.toBeTruthy();
  });
});

describe('what a scan records', () => {
  const prefilled = scanAmountDefaults(honey, jar, UnitSystem.Imperial);

  it('leaves the record’s size to the API while the size is as prefilled', () => {
    expect(scanAmountOf(prefilled, prefilled)).toEqual({
      packaged: true,
      count: 1,
      unitId: 'unit-jar',
      size: null,
      consumeUnitId: null,
    });
  });

  it('records the unit it is used in', () => {
    expect(
      scanAmountOf(
        {
          ...prefilled,
          consumeUnitDisplay: 'tbsp',
          consumeUnitId: 'unit-tbsp',
        },
        prefilled,
      ),
    ).toMatchObject({ consumeUnitId: 'unit-tbsp' });
  });

  it('sends a size the user changed', () => {
    expect(
      scanAmountOf({ ...prefilled, sizeInput: '2.5' }, prefilled),
    ).toMatchObject({
      size: { netWeight: 2.5, netWeightUnitId: 'unit-lb' },
    });
  });

  it('records a measured amount when not packaged', () => {
    expect(
      scanAmountOf(
        {
          ...prefilled,
          packaged: false,
          quantityInput: '3',
          unitId: 'unit-lb',
        },
        prefilled,
      ),
    ).toEqual({
      packaged: false,
      quantity: 3,
      unitId: 'unit-lb',
      consumeUnitId: null,
    });
  });
});
