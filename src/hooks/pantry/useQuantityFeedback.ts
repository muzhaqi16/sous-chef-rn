import { useConversionPreview } from './useConversionPreview';
import type { PantryActionSharedState } from '#components/modals/PantryActionModal';

interface QuantityFeedbackResult {
  /** Conversion preview (text, loading state, raw converted value) */
  conversion: {
    previewText: string | null;
    previewLoading: boolean;
    convertedValue: number | null;
  };
  /** Remaining quantity after subtracting input (null if no valid input) */
  remaining: number | null;
  /** Available quantity for display (net weight or selected unit) */
  availableInUnit: number | null;
  /** Unit symbol for the remaining display (may differ from active unit for dual-tracked) */
  remainingUnitSymbol: string;
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
  const conversion = useConversionPreview({
    pantryItemId: shared.pantryItemId,
    inputQuantity,
    selectedUnitId: shared.activeUnitId,
    selectedUnitSymbol: shared.activeUnitSymbol,
    trackingUnitId:
      shared.isDualTracked && shared.isConvertedUnit
        ? shared.netWeightUnitId!
        : shared.trackingUnitId,
    trackingUnitSymbol:
      shared.isDualTracked && shared.isConvertedUnit
        ? shared.netWeightUnitSymbol!
        : shared.trackingUnitSymbol,
    conversionRatio: shared.isDualTracked
      ? null
      : shared.selectedUnitInfo?.conversionRatio ?? null,
  });

  const hasInput = inputQuantity !== null && !isNaN(inputQuantity);
  let remaining: number | null = null;
  let availableInUnit: number | null = null;
  let remainingUnitSymbol = shared.activeUnitSymbol;

  if (!shared.isConvertedUnit) {
    // Tracking unit selected — simple subtraction
    availableInUnit = shared.trackingQuantity;
    remaining = hasInput ? shared.trackingQuantity - inputQuantity : null;
  } else if (shared.isDualTracked && conversion.convertedValue != null) {
    // API converted input to net weight — subtract directly
    availableInUnit = shared.remainingNetWeight!;
    remainingUnitSymbol = shared.netWeightUnitSymbol!;
    remaining = hasInput
      ? shared.remainingNetWeight! - conversion.convertedValue
      : null;
  } else if (shared.availableInSelectedUnit != null) {
    // Non-dual-tracked converted unit — subtract in selected unit
    availableInUnit = shared.availableInSelectedUnit;
    remaining = hasInput
      ? shared.availableInSelectedUnit - inputQuantity
      : null;
  }

  return { conversion, remaining, availableInUnit, remainingUnitSymbol };
}
