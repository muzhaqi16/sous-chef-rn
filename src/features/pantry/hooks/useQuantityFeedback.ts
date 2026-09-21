import {
  useConversionPreview,
  type UseConversionPreviewOptions,
} from './useConversionPreview';
import type { PantryActionSharedState } from '#features/pantry/components/modals/PantryActionModal';
import { snapDeductionToCap } from '#features/pantry/utils/validateDeductionQuantity';

interface QuantityFeedbackResult {
  /** Conversion preview (text, loading state, raw value, server certainty) */
  conversion: {
    previewText: string | null;
    previewLoading: boolean;
    convertedValue: number | null;
    confidence: number | null;
  };
  /** Remaining quantity after subtracting input (null if no valid input) */
  remaining: number | null;
  /** Available quantity for display (net weight or selected unit) */
  availableInUnit: number | null;
  /** Unit symbol for the remaining display (may differ from active unit for dual-tracked) */
  remainingUnitSymbol: string;
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
  let remaining: number | null = null;
  let availableInUnit: number | null = null;
  let remainingUnitSymbol = shared.activeUnitSymbol;

  if (!shared.isConvertedUnit) {
    // Tracking unit selected — prefer the converter's cap when available
    // (handles dual-tracked items where tracking unit matches net-weight unit).
    availableInUnit = Math.max(
      shared.availableInSelectedUnit ?? 0,
      shared.trackingQuantity,
    );
    remaining = hasInput
      ? availableInUnit - snapDeductionToCap(inputQuantity, availableInUnit)
      : null;
  } else if (
    shared.isDualTracked &&
    conversion.convertedValue != null &&
    shared.remainingNetWeight != null &&
    shared.netWeightUnitSymbol !== undefined
  ) {
    // API converted input to net weight — subtract directly. Dual tracking
    // implies both the remaining weight and its unit are present.
    availableInUnit = shared.remainingNetWeight;
    remainingUnitSymbol = shared.netWeightUnitSymbol;
    remaining = hasInput
      ? shared.remainingNetWeight - conversion.convertedValue
      : null;
  } else if (shared.availableInSelectedUnit != null) {
    // Non-dual-tracked converted unit — subtract in selected unit
    availableInUnit = shared.availableInSelectedUnit;
    remaining = hasInput
      ? shared.availableInSelectedUnit -
        snapDeductionToCap(inputQuantity, shared.availableInSelectedUnit)
      : null;
  }

  return { conversion, remaining, availableInUnit, remainingUnitSymbol };
}
