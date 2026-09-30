import { UnitType } from '#/graphql/generated/schemaTypes';
import type { PantryActionSharedState } from '#features/pantry/components/modals/PantryActionModal';
import { shownStock } from '#domain/stockDisplay';

const PIECE = { id: 'pc', symbol: 'pc' };
const DOZEN = {
  id: 'doz',
  symbol: 'doz',
  type: UnitType.Count,
  hasStandardCountFactor: true,
  baseUnitId: 'pc',
  conversionFactor: 12,
  commonFractions: [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4],
};

/** A pantry action's shared state with the tracking unit (cups) selected. */
export function pantryActionShared(
  trackingQuantity: number,
  overrides: Partial<PantryActionSharedState> = {},
): PantryActionSharedState {
  const state: PantryActionSharedState = {
    selectedUnitInfo: null,
    setSelectedUnitInfo: jest.fn(),
    notes: '',
    setNotes: jest.fn(),
    trackingQuantity,
    trackingUnitSymbol: 'cup',
    trackingUnitId: 'u1',
    displayAsFractionOf: () => true,
    activeUnitSymbol: 'cup',
    activeUnitId: 'u1',
    isConvertedUnit: false,
    exactFactor: 1,
    showStock: held => ({
      quantity: held,
      unitSymbol: state.trackingUnitSymbol,
      displayAsFraction: state.displayAsFractionOf(state.trackingUnitId),
    }),
    pantryItemId: 'pi1',
    defaultUnit: null,
    defaultIncrement: null,
    commonFractions: null,
    availableInSelectedUnit: null,
    availableLoading: false,
    remainingNetWeight: null,
    netWeightUnitSymbol: undefined,
    netWeightUnitId: undefined,
    isDualTracked: false,
    ...overrides,
  };
  return state;
}

/**
 * The same, on a stack of eggs counted in pieces and shown in dozens, with
 * `unit` selected.
 */
export function eggsShared(
  pieces: number,
  unit: 'pc' | 'doz',
): PantryActionSharedState {
  return pantryActionShared(pieces, {
    trackingUnitSymbol: 'pc',
    trackingUnitId: 'pc',
    displayAsFractionOf: () => false,
    activeUnitSymbol: unit,
    activeUnitId: unit,
    isConvertedUnit: unit === 'doz',
    exactFactor: unit === 'doz' ? 12 : 1,
    showStock: held => {
      const shown = shownStock(held, PIECE, DOZEN);
      return {
        quantity: shown.quantity,
        unitSymbol: shown.unit.symbol,
        displayAsFraction: shown.unit === PIECE ? false : null,
      };
    },
  });
}
