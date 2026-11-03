import {
  useConversionPreview,
  type UseConversionPreviewOptions,
} from './useConversionPreview';
import { snapDeductionToCap } from '#features/pantry/utils/validateDeductionQuantity';
import { inCountedUnit } from '#domain/stockDisplay';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/types';

interface QuantityFeedbackResult {
  /** Conversion preview (text, loading state, raw value, server certainty) */
  conversion: {
    previewText: string | null;
    previewLoading: boolean;
    convertedValue: number | null;
    confidence: number | null;
  };
  /** What is left after the input, as it will read (null if no valid input) */
  remaining: ShownQuantity | null;
  /** What is available, for the "exceeds" message */
  available: ShownQuantity | null;
}

/** A pantry action's preview: a dual-tracked item previews into its net weight. */
export function actionConversionOptions(
  inputQuantity: number | null,
  shared: PantryActionSharedState,
): UseConversionPreviewOptions {
  const toNetWeight = shared.isDualTracked && shared.isConvertedUnit;
  const trackingUnitId = toNetWeight
    ? shared.netWeightUnitId
    : shared.trackingUnitId;
  return {
    pantryItemId: shared.pantryItemId,
    inputQuantity,
    selectedUnitId: shared.activeUnitId,
    selectedUnit: shared.activeUnit,
    selectedDisplayAsFraction: shared.displayAsFractionOf(shared.activeUnitId),
    trackingUnitId,
    trackingUnit:
      toNetWeight && shared.netWeightUnit !== undefined
        ? shared.netWeightUnit
        : shared.trackingUnit,
    trackingDisplayAsFraction: shared.displayAsFractionOf(trackingUnitId),
    conversionRatio: shared.isDualTracked
      ? null
      : shared.selectedUnitInfo?.conversionRatio ?? null,
  };
}

/**
 * Shared quantity feedback for consume / waste modals. A dual-tracked item's
 * input converts to net weight through the API; what is left reads as the row
 * will.
 */
export function useQuantityFeedback(
  inputQuantity: number | null,
  shared: PantryActionSharedState,
): QuantityFeedbackResult {
  // For dual-tracked items, convert input to net weight unit (e.g. cups → grams)
  const conversion = useConversionPreview(
    actionConversionOptions(inputQuantity, shared),
  );

  const hasInput = inputQuantity !== null && !isNaN(inputQuantity);
  const inActiveUnit = (quantity: number): ShownQuantity => ({
    quantity,
    unit: shared.activeUnit,
    displayAsFraction: shared.displayAsFractionOf(shared.activeUnitId),
  });
  let remaining: ShownQuantity | null = null;
  let available: ShownQuantity | null = null;

  // What is left always reads as the row will ("9 cans", "1 lb", "2 doz"),
  // whatever unit the amount was typed in.
  if (shared.exactFactor !== null) {
    // The tracking unit or a dozen of it: no conversion.
    const factor = shared.exactFactor;
    const cap = shared.trackingQuantity;
    available = shared.leftAfter(0);
    remaining = hasInput
      ? shared.leftAfter(
          inCountedUnit(
            snapDeductionToCap(inputQuantity, cap / factor),
            factor,
          ),
        )
      : null;
  } else if (!shared.isConvertedUnit) {
    // Tracking unit selected — prefer the converter's cap when available
    // (handles dual-tracked items where tracking unit matches net-weight unit).
    const availableInUnit = Math.max(
      shared.availableInSelectedUnit ?? 0,
      shared.trackingQuantity,
    );
    available = inActiveUnit(availableInUnit);
    remaining = hasInput
      ? shared.leftAfter(snapDeductionToCap(inputQuantity, availableInUnit))
      : null;
  } else if (
    shared.isDualTracked &&
    conversion.convertedValue != null &&
    shared.remainingNetWeight != null &&
    shared.netWeightUnit !== undefined
  ) {
    // The API converted the input to net weight, which the stack's own package
    // size turns into packages. Dual tracking implies both the remaining weight
    // and its unit are present.
    const unit = shared.netWeightUnit;
    const inNetWeight = (quantity: number): ShownQuantity => ({
      quantity,
      unit,
      displayAsFraction: shared.displayAsFractionOf(shared.netWeightUnitId),
    });
    const drawn = shared.packagesOfNetWeight(conversion.convertedValue);
    available = inNetWeight(shared.remainingNetWeight);
    if (hasInput) {
      remaining =
        drawn === null
          ? inNetWeight(shared.remainingNetWeight - conversion.convertedValue)
          : shared.leftAfter(drawn);
    }
  } else if (shared.availableInSelectedUnit != null) {
    // A converted unit on a stack with no net weight: what is available was
    // converted from the tracking quantity, so the same share of it goes.
    const inSelected = shared.availableInSelectedUnit;
    available = inActiveUnit(inSelected);
    if (hasInput) {
      const taken = snapDeductionToCap(inputQuantity, inSelected);
      remaining =
        inSelected > 0
          ? shared.leftAfter((taken / inSelected) * shared.trackingQuantity)
          : inActiveUnit(inSelected - taken);
    }
  }

  return { conversion, remaining, available };
}
