import {
  useConversionPreview,
  type UseConversionPreviewOptions,
} from './useConversionPreview';
import type {
  PantryActionSharedState,
  ShownQuantity,
} from '#features/pantry/components/modals/PantryActionModal';
import { snapDeductionToCap } from '#features/pantry/utils/validateDeductionQuantity';
import { inCountedUnit } from '#domain/stockDisplay';

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
    selectedUnitSymbol: shared.activeUnitSymbol,
    selectedDisplayAsFraction: shared.displayAsFractionOf(shared.activeUnitId),
    trackingUnitId,
    trackingUnitSymbol:
      toNetWeight && shared.netWeightUnitSymbol !== undefined
        ? shared.netWeightUnitSymbol
        : shared.trackingUnitSymbol,
    trackingDisplayAsFraction: shared.displayAsFractionOf(trackingUnitId),
    conversionRatio: shared.isDualTracked
      ? null
      : shared.selectedUnitInfo?.conversionRatio ?? null,
  };
}

/**
 * Shared quantity feedback for consume / waste modals.
 *
 * Handles dual-tracked items: converts input to net weight via API,
 * computes remaining in net weight units.
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
    unitSymbol: shared.activeUnitSymbol,
    displayAsFraction: shared.displayAsFractionOf(shared.activeUnitId),
  });
  let remaining: ShownQuantity | null = null;
  let available: ShownQuantity | null = null;

  if (shared.exactFactor !== null) {
    // The tracking unit or a dozen of it: what is left reads as the stack
    // will ("11 pc", "2 doz"), whichever of the two was typed in.
    const factor = shared.exactFactor;
    const cap = shared.trackingQuantity;
    available = shared.showStock(cap);
    remaining = hasInput
      ? shared.showStock(
          cap -
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
      ? inActiveUnit(
          availableInUnit - snapDeductionToCap(inputQuantity, availableInUnit),
        )
      : null;
  } else if (
    shared.isDualTracked &&
    conversion.convertedValue != null &&
    shared.remainingNetWeight != null &&
    shared.netWeightUnitSymbol !== undefined
  ) {
    // API converted input to net weight — subtract directly. Dual tracking
    // implies both the remaining weight and its unit are present.
    const unitSymbol = shared.netWeightUnitSymbol;
    const inNetWeight = (quantity: number): ShownQuantity => ({
      quantity,
      unitSymbol,
      displayAsFraction: shared.displayAsFractionOf(shared.netWeightUnitId),
    });
    available = inNetWeight(shared.remainingNetWeight);
    remaining = hasInput
      ? inNetWeight(shared.remainingNetWeight - conversion.convertedValue)
      : null;
  } else if (shared.availableInSelectedUnit != null) {
    // Non-dual-tracked converted unit — subtract in selected unit
    available = inActiveUnit(shared.availableInSelectedUnit);
    remaining = hasInput
      ? inActiveUnit(
          shared.availableInSelectedUnit -
            snapDeductionToCap(inputQuantity, shared.availableInSelectedUnit),
        )
      : null;
  }

  return { conversion, remaining, available };
}
