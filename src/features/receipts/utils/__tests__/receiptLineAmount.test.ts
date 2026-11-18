import { UnitType } from '#/graphql/generated/schemaTypes';
import { receiptLineAmount } from '../receiptLineAmount';
import {
  pantryTrackingExamples as examples,
  pantryTrackingPackages as packages,
  pantryTrackingUnits as units,
} from '#/test-utils/fixtures/pantryTrackingFixtures';

const IN_03 = examples['IN-03'];
const IN_02 = examples['IN-02'];

const line = (
  quantity: number,
  unit: { unitId?: string | null; unitText?: string } = {},
) => ({
  quantity,
  unitId: unit.unitId ?? null,
  unitText: unit.unitText ?? '',
});

const LIST_IN_POUNDS = {
  quantity: 2,
  unit: { id: 'unit-lb', type: UnitType.Weight },
};
const LIST_OF_EGGS = {
  quantity: 12,
  unit: { id: 'unit-pc', type: UnitType.Count },
};
const LIST_WITHOUT_UNIT = { quantity: 3, unit: null };
/** What one carton holds, as the line sheet saves it once its unit resolves. */
const CARTON_OF_MILK = {
  quantity: packages.milk.netWeight,
  unitId: packages.milk.netWeightUnitId,
  unitText: units.fluidOunce.symbol,
};
const HELD_IN_PIECES = { id: 'unit-pc', type: UnitType.Count };

describe('receiptLineAmount', () => {
  it.each([
    [
      'a picked unit is that amount',
      line(2.21, { unitId: 'unit-lb' }),
      undefined,
      null,
      {
        amount: { measured: { quantity: 2.21, unitId: 'unit-lb' } },
        fromList: false,
      },
    ],
    [
      'a typed unit names the list line it links to',
      line(1.5, { unitText: 'lb' }),
      LIST_IN_POUNDS,
      null,
      {
        amount: { measured: { quantity: 1.5, unitId: 'unit-lb' } },
        fromList: false,
      },
    ],
    [
      'IN-03: a printed 2.21 lb is what was bought, not the 2 lb the list asked',
      line(IN_03.purchased.quantity, { unitId: IN_03.purchased.unitId }),
      {
        quantity: IN_03.requested.quantity,
        unit: { id: IN_03.requested.unitId, type: UnitType.Weight },
      },
      null,
      {
        amount: { measured: { quantity: 2.21, unitId: units.pound.id } },
        fromList: false,
      },
    ],
    [
      'IN-02: six cans the pantry counts in cans are six cans',
      line(IN_02.expected.quantity),
      undefined,
      { id: units.can.id, type: UnitType.Count },
      {
        amount: { measured: { quantity: 6, unitId: units.can.id } },
        fromList: false,
      },
    ],
    [
      'a typed unit with no line resolves to nothing',
      line(1.5, { unitText: 'lb' }),
      undefined,
      null,
      { needs: 'unit' },
    ],
    [
      'one with no unit is one package, never one of the tracking unit',
      line(1),
      undefined,
      null,
      { amount: { packages: { count: 1 } }, fromList: false },
    ],
    [
      'two with no unit is two packages',
      line(2),
      undefined,
      null,
      { amount: { packages: { count: 2 } }, fromList: false },
    ],
    [
      'a count the pantry holds in pieces is that many pieces',
      line(2),
      undefined,
      HELD_IN_PIECES,
      {
        amount: { measured: { quantity: 2, unitId: 'unit-pc' } },
        fromList: false,
      },
    ],
    [
      "a bare 1 against a list line in a unit is the list's amount",
      line(1),
      LIST_IN_POUNDS,
      null,
      {
        amount: { measured: { quantity: 2, unitId: 'unit-lb' } },
        fromList: true,
      },
    ],
    [
      // The API counts a bare package of a counted line as one piece: one egg.
      'a bare 1 against a counted list line is the list amount, never one piece',
      line(1),
      LIST_OF_EGGS,
      HELD_IN_PIECES,
      {
        amount: { measured: { quantity: 12, unitId: 'unit-pc' } },
        fromList: true,
      },
    ],
    [
      'a count equal to a counted list line is in its unit',
      line(12),
      LIST_OF_EGGS,
      null,
      {
        amount: { measured: { quantity: 12, unitId: 'unit-pc' } },
        fromList: true,
      },
    ],
    [
      // Two cartons or two eggs: the API would record two eggs, so it is asked.
      'any other count against a counted list line is asked',
      line(2),
      LIST_OF_EGGS,
      null,
      { needs: 'amount' },
    ],
    [
      // The API sizes them: the line's stored size, the catalog pack, else the line's amount each.
      'a count against a weighed list line is that many packages',
      line(3),
      LIST_IN_POUNDS,
      null,
      { amount: { packages: { count: 3 } }, fromList: false },
    ],
    [
      'a count against a list line with no unit is that many packages',
      line(2),
      LIST_WITHOUT_UNIT,
      null,
      { amount: { packages: { count: 2 } }, fromList: false },
    ],
    [
      'a unit with no usable amount asks for the quantity, not a unit',
      line(0, { unitId: 'unit-lb' }),
      undefined,
      null,
      { needs: 'quantity' },
    ],
    [
      'a part of something no unit names is refused',
      line(0.5),
      undefined,
      null,
      { needs: 'unit' },
    ],
    [
      'a part against a list line in a unit is refused too',
      line(0.5),
      LIST_IN_POUNDS,
      null,
      { needs: 'unit' },
    ],
    [
      'IN-01: a printed 64 fl oz carton is one package holding it, whatever the list asked',
      { ...line(1), packageSize: CARTON_OF_MILK },
      LIST_IN_POUNDS,
      null,
      {
        amount: { packages: { count: 1, size: packages.milk } },
        fromList: false,
      },
    ],
    [
      'packages counted in a unit are that many of it, each holding the size',
      {
        ...line(2, { unitId: units.carton.id, unitText: 'carton' }),
        packageSize: CARTON_OF_MILK,
      },
      undefined,
      null,
      {
        amount: {
          packages: { count: 2, size: packages.milk, unitId: units.carton.id },
        },
        fromList: false,
      },
    ],
    [
      'a size whose unit is not resolved asks for it',
      { ...line(1), packageSize: { ...CARTON_OF_MILK, unitId: null } },
      undefined,
      null,
      { needs: 'sizeUnit' },
    ],
    [
      'a typed count unit that is not resolved asks for it',
      { ...line(1, { unitText: 'carton' }), packageSize: CARTON_OF_MILK },
      undefined,
      null,
      { needs: 'unit' },
    ],
    [
      'part of a package is refused',
      { ...line(0.5), packageSize: CARTON_OF_MILK },
      undefined,
      null,
      { needs: 'quantity' },
    ],
  ])('%s', (_case, choice, listLine, heldUnit, expected) => {
    expect(receiptLineAmount(choice, listLine, heldUnit)).toEqual(expected);
  });
});
