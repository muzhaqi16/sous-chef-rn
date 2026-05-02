import { renderHook, waitFor } from '@testing-library/react-native';
import type { MockedResponse } from '@apollo/client/testing';
import {
  ConsumptionUnitsForItemDocument,
  RestockUnitsForItemDocument,
} from '#operations/pantry/pantry.generated';
import {
  UnitType,
  UnitRole,
  UnitSource,
} from '#/graphql/generated/schemaTypes';
import { createApolloWrapper } from '../../../../__tests__/helpers/apolloMockProvider';
import { useOperationUnits, PantryOperation } from '../useOperationUnits';

function makeRankedUnit(overrides: Record<string, unknown> = {}) {
  return {
    __typename: 'RankedUnit',
    rank: 1,
    source: UnitSource.Auto,
    defaultIncrement: null,
    commonFractions: null,
    isWholeContainer: false,
    unit: {
      __typename: 'Unit',
      id: 'unit-1',
      name: 'gram',
      symbol: 'g',
      type: UnitType.Weight,
      unitRole: UnitRole.Measurement,
      commonFractions: null,
      displayAsFraction: false,
    },
    ...overrides,
  };
}

function consumptionMock(
  units: ReturnType<typeof makeRankedUnit>[],
  variables = {
    itemId: 'item-1',
    trackingUnitId: 'unit-1',
    netWeightUnitId: null,
  },
): MockedResponse {
  return {
    request: { query: ConsumptionUnitsForItemDocument, variables },
    result: { data: { consumptionUnitsForItem: units } },
  };
}

function consumptionErrorMock(
  variables = {
    itemId: 'item-1',
    trackingUnitId: 'unit-1',
    netWeightUnitId: null,
  },
): MockedResponse {
  return {
    request: { query: ConsumptionUnitsForItemDocument, variables },
    error: new Error('Query failed'),
  };
}

function restockMock(
  units: ReturnType<typeof makeRankedUnit>[],
  variables = { pantryItemId: 'pantry-item-1' },
): MockedResponse {
  return {
    request: { query: RestockUnitsForItemDocument, variables },
    result: { data: { restockUnitsForItem: units } },
  };
}

function restockErrorMock(
  variables = { pantryItemId: 'pantry-item-1' },
): MockedResponse {
  return {
    request: { query: RestockUnitsForItemDocument, variables },
    error: new Error('Restock query failed'),
  };
}

const defaultOptions = {
  itemId: 'item-1',
  pantryItemId: 'pantry-item-1',
  trackingUnitId: 'unit-1',
  trackingUnitType: UnitType.Weight,
  netWeightUnitId: null,
};

describe('useOperationUnits', () => {
  describe('query routing', () => {
    it('uses consumption query when operation is Consume', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        { wrapper: createApolloWrapper([consumptionMock([makeRankedUnit()])]) },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.allUnits).toHaveLength(1);
    });

    it('uses consumption query when operation is Waste', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Waste,
          }),
        { wrapper: createApolloWrapper([consumptionMock([makeRankedUnit()])]) },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.allUnits).toHaveLength(1);
    });

    it('uses restock query when operation is Restock', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Restock,
          }),
        {
          wrapper: createApolloWrapper([
            restockMock([makeRankedUnit({ rank: 1 })]),
          ]),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));
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
        { wrapper: createApolloWrapper([consumptionMock([makeRankedUnit()])]) },
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.groups).toEqual([]);
      expect(result.current.allUnits).toEqual([]);
      expect(result.current.defaultUnit).toBeNull();
    });
  });

  describe('skip behavior', () => {
    it('skips consumption query when itemId is undefined (no mock consumed)', () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            itemId: undefined,
            operation: PantryOperation.Consume,
          }),
        { wrapper: createApolloWrapper([]) },
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
        { wrapper: createApolloWrapper([]) },
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.allUnits).toEqual([]);
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
          wrapper: createApolloWrapper([
            consumptionMock([
              makeRankedUnit({
                rank: 1,
                unit: {
                  __typename: 'Unit',
                  id: 'u-g',
                  name: 'gram',
                  symbol: 'g',
                  type: UnitType.Weight,
                  unitRole: UnitRole.Measurement,
                  commonFractions: null,
                  displayAsFraction: false,
                },
              }),
              makeRankedUnit({
                rank: 2,
                unit: {
                  __typename: 'Unit',
                  id: 'u-ml',
                  name: 'milliliter',
                  symbol: 'ml',
                  type: UnitType.Volume,
                  unitRole: UnitRole.Measurement,
                  commonFractions: null,
                  displayAsFraction: false,
                },
              }),
              makeRankedUnit({
                rank: 3,
                unit: {
                  __typename: 'Unit',
                  id: 'u-piece',
                  name: 'piece',
                  symbol: 'pc',
                  type: UnitType.Count,
                  unitRole: UnitRole.Portion,
                  commonFractions: null,
                  displayAsFraction: false,
                },
              }),
              makeRankedUnit({
                rank: 4,
                unit: {
                  __typename: 'Unit',
                  id: 'u-oz',
                  name: 'ounce',
                  symbol: 'oz',
                  type: UnitType.Weight,
                  unitRole: UnitRole.Measurement,
                  commonFractions: null,
                  displayAsFraction: false,
                },
              }),
            ]),
          ]),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.groups).toHaveLength(3);
      expect(result.current.groups[0].type).toBe(UnitType.Weight);
      expect(result.current.groups[0].label).toBe('Weight');
      expect(result.current.groups[0].units).toHaveLength(2);
      expect(result.current.groups[1].type).toBe(UnitType.Volume);
      expect(result.current.groups[1].units).toHaveLength(1);
      expect(result.current.groups[2].type).toBe(UnitType.Count);
      expect(result.current.groups[2].units).toHaveLength(1);
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
          wrapper: createApolloWrapper([
            consumptionMock([
              makeRankedUnit({ rank: 1, source: UnitSource.TrackingUnit }),
              makeRankedUnit({
                rank: 2,
                unit: {
                  __typename: 'Unit',
                  id: 'u-ml',
                  name: 'milliliter',
                  symbol: 'ml',
                  type: UnitType.Volume,
                  unitRole: UnitRole.Measurement,
                  commonFractions: null,
                  displayAsFraction: false,
                },
              }),
            ]),
          ]),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.defaultUnit).toEqual({
        unitId: 'unit-1',
        unitSymbol: 'g',
        unitName: 'gram',
        unitType: UnitType.Weight,
        isTrackingUnit: true,
        conversionRatio: null,
        conversionConfidence: null,
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
          wrapper: createApolloWrapper([
            consumptionMock([
              makeRankedUnit({
                rank: 1,
                defaultIncrement: 50,
                commonFractions: [0.25, 0.5, 0.75],
              }),
            ]),
          ]),
        },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

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
        { wrapper: createApolloWrapper([consumptionMock([])]) },
      );

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.defaultUnit).toBeNull();
      expect(result.current.defaultIncrement).toBeNull();
      expect(result.current.defaultCommonFractions).toBeNull();
    });
  });

  describe('error state', () => {
    it('exposes error from consumption query', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Consume,
          }),
        { wrapper: createApolloWrapper([consumptionErrorMock()]) },
      );

      await waitFor(() => expect(result.current.error).toBeDefined());
      expect(result.current.error?.message).toBe('Query failed');
    });

    it('exposes error from restock query', async () => {
      const { result } = renderHook(
        () =>
          useOperationUnits({
            ...defaultOptions,
            operation: PantryOperation.Restock,
          }),
        { wrapper: createApolloWrapper([restockErrorMock()]) },
      );

      await waitFor(() => expect(result.current.error).toBeDefined());
      expect(result.current.error?.message).toBe('Restock query failed');
    });
  });
});
