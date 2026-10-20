import { UnitType } from '#/graphql/generated/schemaTypes';
import { receiptLineAmount } from '../receiptLineAmount';

const line = (
  quantity: number,
  unit: { unitId?: string | null; unitText?: string } = {},
) => ({
  quantity,
  unitId: unit.unitId ?? null,
  unitText: unit.unitText ?? '',
});

const LIST_IN_POUNDS = { quantity: 2, unit: { id: 'unit-lb' } };
const LIST_WITHOUT_UNIT = { quantity: 3, unit: null };
const HELD_IN_PIECES = { id: 'unit-pc', type: UnitType.Count };

describe('receiptLineAmount', () => {
  it.each([
    [
      'a picked unit is that amount',
      line(2.21, { unitId: 'unit-lb' }),
      undefined,
      null,
      { measured: { quantity: 2.21, unitId: 'unit-lb' } },
    ],
    [
      'a typed unit names the list line it links to',
      line(1.5, { unitText: 'lb' }),
      LIST_IN_POUNDS,
      null,
      { measured: { quantity: 1.5, unitId: 'unit-lb' } },
    ],
    [
      'a typed unit with no line resolves to nothing',
      line(1.5, { unitText: 'lb' }),
      undefined,
      null,
      null,
    ],
    [
      'one with no unit is one package, never one of the tracking unit',
      line(1),
      undefined,
      null,
      { packages: { count: 1 } },
    ],
    [
      'two with no unit is two packages',
      line(2),
      undefined,
      null,
      { packages: { count: 2 } },
    ],
    [
      'a count the pantry holds in pieces is that many pieces',
      line(2),
      undefined,
      HELD_IN_PIECES,
      { measured: { quantity: 2, unitId: 'unit-pc' } },
    ],
    [
      "a bare 1 against a list line in a unit is the list's amount",
      line(1),
      LIST_IN_POUNDS,
      null,
      { measured: { quantity: 2, unitId: 'unit-lb' } },
    ],
    [
      'a count against a list line in a unit is that many packages',
      line(3),
      LIST_IN_POUNDS,
      null,
      { packages: { count: 3 } },
    ],
    [
      'a count against a list line with no unit is that many packages',
      line(2),
      LIST_WITHOUT_UNIT,
      null,
      { packages: { count: 2 } },
    ],
    [
      'a part of something no unit names is refused',
      line(0.5),
      undefined,
      null,
      null,
    ],
    [
      'a part against a list line in a unit is refused too',
      line(0.5),
      LIST_IN_POUNDS,
      null,
      null,
    ],
  ])('%s', (_case, choice, listLine, heldUnit, expected) => {
    expect(receiptLineAmount(choice, listLine, heldUnit)).toEqual(expected);
  });
});
