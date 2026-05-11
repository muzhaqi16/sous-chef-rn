import { alertService } from '#/services/alertService';
import { parseFractionalInput } from '#/utils/fractionUtils';
import { formatQuantity } from '#/utils/formatQuantity';
import type { PantryActionSharedState } from '#components/modals/PantryActionModal';

/**
 * Validates a deduction quantity (consume or waste) against available stock.
 * Shows an alert on validation failure.
 *
 * @returns The parsed numeric value, or null if validation failed.
 */
export function validateDeductionQuantity(
  quantityInput: string,
  shared: PantryActionSharedState,
  actionVerb: 'consume' | 'waste',
): number | null {
  const value = parseFractionalInput(quantityInput);
  if (value === null || isNaN(value) || value <= 0) {
    alertService.alert(
      'Error',
      actionVerb === 'waste'
        ? 'Please enter a valid waste amount'
        : 'Please enter a valid quantity',
    );
    return null;
  }

  if (shared.isConvertedUnit && shared.availableLoading) {
    alertService.alert(
      'Please Wait',
      'Still calculating available quantity...',
    );
    return null;
  }

  // For dual-tracked items where the tracking unit matches the net-weight unit,
  // useConvertAvailableQuantity publishes remainingNetWeight as availableInSelectedUnit
  // even with the tracking unit selected. Prefer the larger of the two so the user
  // can waste/consume up to the actual remaining amount.
  const cap = shared.isConvertedUnit
    ? shared.availableInSelectedUnit ?? shared.trackingQuantity
    : Math.max(shared.availableInSelectedUnit ?? 0, shared.trackingQuantity);

  if (value > cap) {
    alertService.alert(
      'Error',
      `Cannot ${actionVerb} more than available quantity (${formatQuantity(
        cap,
      )} ${shared.activeUnitSymbol})`,
    );
    return null;
  }

  return value;
}
