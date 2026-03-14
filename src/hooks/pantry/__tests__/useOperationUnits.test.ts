import { renderHook } from '@testing-library/react-native';
import { useOperationUnits, PantryOperation } from '../useOperationUnits';

const mockConsumptionResult = {
  data: undefined as any,
  loading: false,
  error: undefined,
};

const mockRestockResult = {
  data: undefined as any,
  loading: false,
  error: undefined,
};

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useConsumptionUnitsForItemQuery: jest.fn(() => mockConsumptionResult),
  useRestockUnitsForItemQuery: jest.fn(() => mockRestockResult),
}));

const {
  useConsumptionUnitsForItemQuery,
  useRestockUnitsForItemQuery,
  UnitType,
  UnitRole,
  UnitSource,
} = jest.requireMock('#generated');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRankedUnit(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    source: UnitSource.Auto,
    defaultIncrement: null,
    commonFractions: null,
    isWholeContainer: false,
    unit: {
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

const defaultOptions = {
  itemId: 'item-1',
  pantryItemId: 'pantry-item-1',
  trackingUnitId: 'unit-1',
  trackingUnitType: UnitType.Weight,
  netWeightUnitId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConsumptionResult.data = undefined;
  mockConsumptionResult.loading = false;
  mockConsumptionResult.error = undefined;
  mockRestockResult.data = undefined;
  mockRestockResult.loading = false;
  mockRestockResult.error = undefined;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useOperationUnits', () => {
  describe('query routing', () => {
    it('calls consumptionUnitsForItemQuery when operation is Consume', () => {
      renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

      expect(useConsumptionUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      );
      expect(useRestockUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('calls consumptionUnitsForItemQuery when operation is Waste', () => {
      renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Waste,
        }),
      );

      expect(useConsumptionUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      );
      expect(useRestockUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('calls restockUnitsForItemQuery when operation is Restock', () => {
      renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Restock,
        }),
      );

      expect(useRestockUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      );
      expect(useConsumptionUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe('loading state', () => {
    it('returns empty groups when loading', () => {
      mockConsumptionResult.loading = true;

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.groups).toEqual([]);
      expect(result.current.allUnits).toEqual([]);
      expect(result.current.defaultUnit).toBeNull();
    });
  });

  describe('skip behavior', () => {
    it('skips consumption query when itemId is undefined', () => {
      renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          itemId: undefined,
          operation: PantryOperation.Consume,
        }),
      );

      expect(useConsumptionUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });

    it('skips restock query when pantryItemId is undefined', () => {
      renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          pantryItemId: undefined,
          operation: PantryOperation.Restock,
        }),
      );

      expect(useRestockUnitsForItemQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      );
    });
  });

  describe('grouping', () => {
    it('correctly groups units by UnitType', () => {
      mockConsumptionResult.data = {
        consumptionUnitsForItem: [
          makeRankedUnit({
            rank: 1,
            unit: {
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
              id: 'u-oz',
              name: 'ounce',
              symbol: 'oz',
              type: UnitType.Weight,
              unitRole: UnitRole.Measurement,
              commonFractions: null,
              displayAsFraction: false,
            },
          }),
        ],
      };

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

      // Tracking unit type (Weight) should come first
      expect(result.current.groups).toHaveLength(3);
      expect(result.current.groups[0].type).toBe(UnitType.Weight);
      expect(result.current.groups[0].label).toBe('Weight');
      expect(result.current.groups[0].units).toHaveLength(2);

      expect(result.current.groups[1].type).toBe(UnitType.Volume);
      expect(result.current.groups[1].label).toBe('Volume');
      expect(result.current.groups[1].units).toHaveLength(1);

      expect(result.current.groups[2].type).toBe(UnitType.Count);
      expect(result.current.groups[2].label).toBe('Count');
      expect(result.current.groups[2].units).toHaveLength(1);

      expect(result.current.allUnits).toHaveLength(4);
    });
  });

  describe('default unit', () => {
    it('resolves default unit to first ranked unit', () => {
      mockConsumptionResult.data = {
        consumptionUnitsForItem: [
          makeRankedUnit({
            rank: 1,
            source: UnitSource.TrackingUnit,
            unit: {
              id: 'unit-1',
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
              id: 'u-ml',
              name: 'milliliter',
              symbol: 'ml',
              type: UnitType.Volume,
              unitRole: UnitRole.Measurement,
              commonFractions: null,
              displayAsFraction: false,
            },
          }),
        ],
      };

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

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

    it('exposes defaultIncrement and commonFractions from default unit', () => {
      mockConsumptionResult.data = {
        consumptionUnitsForItem: [
          makeRankedUnit({
            rank: 1,
            defaultIncrement: 50,
            commonFractions: [0.25, 0.5, 0.75],
          }),
        ],
      };

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

      expect(result.current.defaultIncrement).toBe(50);
      expect(result.current.defaultCommonFractions).toEqual([0.25, 0.5, 0.75]);
    });

    it('returns null defaultIncrement and defaultCommonFractions when no units', () => {
      mockConsumptionResult.data = {
        consumptionUnitsForItem: [],
      };

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

      expect(result.current.defaultUnit).toBeNull();
      expect(result.current.defaultIncrement).toBeNull();
      expect(result.current.defaultCommonFractions).toBeNull();
    });
  });

  describe('error state', () => {
    it('exposes error from consumption query', () => {
      const testError = new Error('Query failed');
      mockConsumptionResult.error = testError as any;

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Consume,
        }),
      );

      expect(result.current.error).toBe(testError);
    });

    it('exposes error from restock query', () => {
      const testError = new Error('Restock query failed');
      mockRestockResult.error = testError as any;

      const { result } = renderHook(() =>
        useOperationUnits({
          ...defaultOptions,
          operation: PantryOperation.Restock,
        }),
      );

      expect(result.current.error).toBe(testError);
    });
  });
});
