import { renderHook } from '@testing-library/react-native';
import type { MockFor, MockPart } from '#/test-utils/apolloMockProvider';
import {
  ConsumptionUnitsForPantryItemDocument,
  RestockUnitsForPantryItemDocument,
  type ConsumptionUnitsForPantryItemQuery,
} from '#features/pantry/graphql/pantry.generated';
import {
  UnitType,
  UnitRole,
  UnitSource,
} from '#/graphql/generated/schemaTypes';
import { createApolloTestWrapper } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { useOperationUnits, PantryOperation } from '../useOperationUnits';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';

type RankedUnit =
  ConsumptionUnitsForPantryItemQuery['consumptionUnitsForPantryItem'][number];

function makeRankedUnit(
  overrides: MockPart<RankedUnit> = {},
): MockPart<RankedUnit> {
  return {
    __typename: 'RankedUnit',
    rank: 1,
    source: UnitSource.Auto,
    defaultIncrement: null,
    commonFractions: null,
    isWholeContainer: false,
    unit: asAbbreviation({
      __typename: 'Unit',
      id: 'unit-1',
      name: 'gram',
      symbol: 'g',
      type: UnitType.Weight,
      unitRole: UnitRole.Measurement,
      commonFractions: null,
      displayAsFraction: false,
      hasStandardCountFactor: false,
    }),
    ...overrides,
  };
}

function consumptionMock(
  units: ReturnType<typeof makeRankedUnit>[],
  variables = { pantryItemId: 'pantry-item-1' },
): MockFor<typeof ConsumptionUnitsForPantryItemDocument> {
  return {
    request: { query: ConsumptionUnitsForPantryItemDocument, variables },
    result: { data: { consumptionUnitsForPantryItem: units } },
  };
}

function consumptionErrorMock(
  variables = { pantryItemId: 'pantry-item-1' },
): MockFor<typeof ConsumptionUnitsForPantryItemDocument> {
  return {
    request: { query: ConsumptionUnitsForPantryItemDocument, variables },
    error: new Error('Query failed'),
  };
}

function restockMock(
  units: ReturnType<typeof makeRankedUnit>[],
  variables = { pantryItemId: 'pantry-item-1' },
): MockFor<typeof RestockUnitsForPantryItemDocument> {
  return {
    request: { query: RestockUnitsForPantryItemDocument, variables },
    result: { data: { restockUnitsForPantryItem: units } },
  };
}

function restockErrorMock(
  variables = { pantryItemId: 'pantry-item-1' },
): MockFor<typeof RestockUnitsForPantryItemDocument> {
  return {
    request: { query: RestockUnitsForPantryItemDocument, variables },
    error: new Error('Restock query failed'),
  };
}

const defaultOptions = {
  pantryItemId: 'pantry-item-1',
  trackingUnitId: 'unit-1',
  trackingUnitType: UnitType.Weight,
  netWeightUnitId: null,
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useOperationUnits', () => {
  describe('query routing', () => {
    it('uses consumption query when operation is Consume', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [consumptionMock([makeRankedUnit()])],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits).toHaveLength(1);
    });

    it('uses consumption query when operation is Waste', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Waste,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [consumptionMock([makeRankedUnit()])],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits).toHaveLength(1);
    });

    it('offers the measured unit the stack profile earns, keyed by the stack alone', async () => {
      // A bag with a net weight is consumable in grams only because the
      // SERVER reads the stack's net weight; the client sends nothing but the
      // stack id, so a profile field it does not hold still reaches the picker.
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            trackingUnitId: 'bag',
            trackingUnitType: UnitType.Count,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [
              consumptionMock([makeRankedUnit({ rank: 2 })], {
                pantryItemId: 'pantry-item-1',
              }),
            ],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);
      const weight = result.current.groups.find(
        group => group.type === UnitType.Weight,
      );
      expect(weight?.units.map(unit => unit.unit.symbol)).toEqual(['g']);
    });

    it('uses restock query when operation is Restock', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Restock,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [restockMock([makeRankedUnit({ rank: 1 })])],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits).toHaveLength(1);
    });
  });

  describe('loading state', () => {
    it('returns empty groups while loading', () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [consumptionMock([makeRankedUnit()])],
          }),
        },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.groups).toEqual([]);
      expect(result.current.allUnits).toEqual([]);
      expect(result.current.defaultUnit).toBeNull();
    });
  });

  describe('skip behavior', () => {
    it('skips consumption query when pantryItemId is undefined (no mock consumed)', () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            pantryItemId: undefined,
            operation: PantryOperation.Consume,
          }),
        { wrapper: createApolloTestWrapper({ operationMocks: [] }) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits).toEqual([]);
    });

    it('skips restock query when pantryItemId is undefined', () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            pantryItemId: undefined,
            operation: PantryOperation.Restock,
          }),
        { wrapper: createApolloTestWrapper({ operationMocks: [] }) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits).toEqual([]);
    });
  });

  describe("the server's per-stack list", () => {
    const countUnit = (
      id: string,
      hasStandardCountFactor: boolean,
      source = UnitSource.Auto,
    ) =>
      makeRankedUnit({
        source,
        unit: asAbbreviation({
          __typename: 'Unit',
          id,
          name: id,
          symbol: id,
          type: UnitType.Count,
          unitRole: UnitRole.Portion,
          commonFractions: null,
          displayAsFraction: false,
          hasStandardCountFactor,
        }),
      });

    const renderConsume = (units: ReturnType<typeof makeRankedUnit>[]) =>
      renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            trackingUnitType: UnitType.Count,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [consumptionMock(units)],
          }),
        },
      );

    it('offers an AUTO portion unit the server lists, universal factor or not', async () => {
      // The server lists bulb for a garlic stack and accepts it.
      const { result } = renderConsume([
        countUnit('dozen', true),
        countUnit('bulb', false),
      ]);

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits.map(u => u.unitId)).toEqual([
        'dozen',
        'bulb',
      ]);
    });

    it('keeps a CURATED count unit', async () => {
      const { result } = renderConsume([
        countUnit('clove', false, UnitSource.Curated),
      ]);

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits.map(u => u.unitId)).toEqual(['clove']);
    });

    it('keeps the tracking unit', async () => {
      const { result } = renderConsume([
        countUnit('head', false, UnitSource.TrackingUnit),
      ]);

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits.map(u => u.unitId)).toEqual(['head']);
    });
  });

  describe('grouping', () => {
    it('correctly groups units by UnitType with tracking type first', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [
              consumptionMock([
                makeRankedUnit({
                  rank: 1,
                  unit: asAbbreviation({
                    __typename: 'Unit',
                    id: 'u-g',
                    name: 'gram',
                    symbol: 'g',
                    type: UnitType.Weight,
                    unitRole: UnitRole.Measurement,
                    commonFractions: null,
                    displayAsFraction: false,
                  }),
                }),
                makeRankedUnit({
                  rank: 2,
                  unit: asAbbreviation({
                    __typename: 'Unit',
                    id: 'u-ml',
                    name: 'milliliter',
                    symbol: 'ml',
                    type: UnitType.Volume,
                    unitRole: UnitRole.Measurement,
                    commonFractions: null,
                    displayAsFraction: false,
                  }),
                }),
                makeRankedUnit({
                  rank: 3,
                  unit: asAbbreviation({
                    __typename: 'Unit',
                    id: 'u-piece',
                    name: 'piece',
                    symbol: 'pc',
                    type: UnitType.Count,
                    unitRole: UnitRole.Portion,
                    commonFractions: null,
                    displayAsFraction: false,
                  }),
                }),
                makeRankedUnit({
                  rank: 4,
                  unit: asAbbreviation({
                    __typename: 'Unit',
                    id: 'u-oz',
                    name: 'ounce',
                    symbol: 'oz',
                    type: UnitType.Weight,
                    unitRole: UnitRole.Measurement,
                    commonFractions: null,
                    displayAsFraction: false,
                  }),
                }),
              ]),
            ],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);

      expect(result.current.groups).toHaveLength(3);
      expect(result.current.groups[0]!.type).toBe(UnitType.Weight);
      expect(result.current.groups[0]!.label).toBe('Weight');
      expect(result.current.groups[0]!.units).toHaveLength(2);
      expect(result.current.groups[1]!.type).toBe(UnitType.Volume);
      expect(result.current.groups[1]!.units).toHaveLength(1);
      expect(result.current.groups[2]!.type).toBe(UnitType.Count);
      expect(result.current.groups[2]!.units).toHaveLength(1);
      expect(result.current.allUnits).toHaveLength(4);
    });
  });

  describe('default unit', () => {
    it('resolves default unit to first ranked unit', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [
              consumptionMock([
                makeRankedUnit({ rank: 1, source: UnitSource.TrackingUnit }),
                makeRankedUnit({
                  rank: 2,
                  unit: asAbbreviation({
                    __typename: 'Unit',
                    id: 'u-ml',
                    name: 'milliliter',
                    symbol: 'ml',
                    type: UnitType.Volume,
                    unitRole: UnitRole.Measurement,
                    commonFractions: null,
                    displayAsFraction: false,
                  }),
                }),
              ]),
            ],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);

      expect(result.current.defaultUnit).toEqual({
        unitId: 'unit-1',
        unit: expect.objectContaining({ symbol: 'g', name: 'gram' }),
        unitType: UnitType.Weight,
        isTrackingUnit: true,
        conversionRatio: null,
        conversionConfidence: null,
      });
    });

    // Honey held in jars of grams, used by the tablespoon.
    describe('a stack the household uses in tablespoons', () => {
      const tbsp = makeRankedUnit({
        rank: 1,
        unit: asAbbreviation({
          __typename: 'Unit',
          id: 'u-tbsp',
          name: 'tablespoon',
          symbol: 'tbsp',
          type: UnitType.Volume,
          unitRole: UnitRole.Measurement,
          commonFractions: null,
          displayAsFraction: true,
        }),
      });
      const grams = makeRankedUnit({ rank: 2 });

      const defaultFor = async (
        operation: PantryOperation,
        units = [grams, tbsp],
      ) => {
        const { result } = renderHook(
          () =>
            useOperationUnits({
              ...defaultOptions,
              netWeightUnitId: 'unit-1',
              consumeUnitId: 'u-tbsp',
              operation,
            }),
          {
            wrapper: createApolloTestWrapper({
              operationMocks: [consumptionMock(units)],
            }),
          },
        );
        await drainTimers();
        expect(result.current.loading).toBe(false);
        return result.current.defaultUnit?.unitId;
      };

      it('opens a use on it, ahead of the net weight unit', async () => {
        expect(await defaultFor(PantryOperation.Consume)).toBe('u-tbsp');
      });

      it('leaves waste on the net weight unit', async () => {
        expect(await defaultFor(PantryOperation.Waste)).toBe('unit-1');
      });

      it('falls back once the stack no longer takes it', async () => {
        expect(await defaultFor(PantryOperation.Consume, [grams])).toBe(
          'unit-1',
        );
      });
    });

    // Peanut butter held in jars of grams, which households use by the
    // tablespoon: the server ranks that unit first, as curated.
    describe('a unit households use the product in', () => {
      const tbsp = (source: UnitSource) =>
        makeRankedUnit({
          rank: 1,
          source,
          unit: asAbbreviation({
            __typename: 'Unit',
            id: 'u-tbsp',
            name: 'tablespoon',
            symbol: 'tbsp',
            type: UnitType.Volume,
            unitRole: UnitRole.Measurement,
            commonFractions: null,
            displayAsFraction: true,
          }),
        });
      const grams = makeRankedUnit({ rank: 2 });

      const defaultFor = async (
        operation: PantryOperation,
        units: MockPart<RankedUnit>[],
      ) => {
        const { result } = renderHook(
          () =>
            useOperationUnits({
              ...defaultOptions,
              netWeightUnitId: 'unit-1',
              operation,
            }),
          {
            wrapper: createApolloTestWrapper({
              operationMocks: [consumptionMock(units)],
            }),
          },
        );
        await drainTimers();
        expect(result.current.loading).toBe(false);
        return result.current.defaultUnit?.unitId;
      };

      it('opens a use on it, ahead of the net weight unit', async () => {
        expect(
          await defaultFor(PantryOperation.Consume, [
            grams,
            tbsp(UnitSource.Curated),
          ]),
        ).toBe('u-tbsp');
      });

      it('leaves waste on the net weight unit', async () => {
        expect(
          await defaultFor(PantryOperation.Waste, [
            grams,
            tbsp(UnitSource.Curated),
          ]),
        ).toBe('unit-1');
      });

      it('keeps the net weight unit ahead of a unit merely convertible', async () => {
        expect(
          await defaultFor(PantryOperation.Consume, [
            grams,
            tbsp(UnitSource.Auto),
          ]),
        ).toBe('unit-1');
      });
    });

    it('exposes defaultIncrement and commonFractions from default unit', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [
              consumptionMock([
                makeRankedUnit({
                  rank: 1,
                  defaultIncrement: 50,
                  commonFractions: [0.25, 0.5, 0.75],
                }),
              ]),
            ],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);

      expect(result.current.defaultIncrement).toBe(50);
      expect(result.current.defaultCommonFractions).toEqual([0.25, 0.5, 0.75]);
    });

    it('returns null defaultIncrement and defaultCommonFractions when no units', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [consumptionMock([])],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);

      expect(result.current.defaultUnit).toBeNull();
      expect(result.current.defaultIncrement).toBeNull();
      expect(result.current.defaultCommonFractions).toBeNull();
    });
  });

  // A failed read hides the picker; the modal falls back to the tracking unit.
  describe('failed read', () => {
    it('settles with no groups or default after a consumption query error', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [consumptionErrorMock()],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.groups).toEqual([]);
      expect(result.current.defaultUnit).toBeNull();
    });

    it('settles with no groups or default after a restock query error', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Restock,
          }),
        {
          wrapper: createApolloTestWrapper({
            operationMocks: [restockErrorMock()],
          }),
        },
      );

      await drainTimers();
      expect(result.current.loading).toBe(false);
      expect(result.current.groups).toEqual([]);
      expect(result.current.defaultUnit).toBeNull();
    });
  });
});
