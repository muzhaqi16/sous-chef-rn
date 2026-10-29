import { UnitType } from '#/graphql/generated/schemaTypes';
import { shownStock } from '#domain/stockDisplay';
import type { PantryActionSharedState } from '#features/pantry/types';

const CUP = { symbol: 'cup' };
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
    trackingUnit: CUP,
    trackingUnitId: 'u1',
    displayAsFractionOf: () => true,
    activeUnit: CUP,
    activeUnitId: 'u1',
    isConvertedUnit: false,
    exactFactor: 1,
    showStock: held => ({
      quantity: held,
      unit: state.trackingUnit,
      displayAsFraction: state.displayAsFractionOf(state.trackingUnitId),
    }),
    pantryItemId: 'pi1',
    defaultUnit: null,
    defaultIncrement: null,
    commonFractions: null,
    availableInSelectedUnit: null,
    availableLoading: false,
    remainingNetWeight: null,
    netWeightUnit: undefined,
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
    trackingUnit: PIECE,
    trackingUnitId: 'pc',
    displayAsFractionOf: () => false,
    activeUnit: unit === 'doz' ? DOZEN : PIECE,
    activeUnitId: unit,
    isConvertedUnit: unit === 'doz',
    exactFactor: unit === 'doz' ? 12 : 1,
    showStock: held => {
      const shown = shownStock(held, PIECE, DOZEN);
      return {
        quantity: shown.quantity,
        unit: shown.unit,
        displayAsFraction: shown.unit === PIECE ? false : null,
      };
    },
  });
}
