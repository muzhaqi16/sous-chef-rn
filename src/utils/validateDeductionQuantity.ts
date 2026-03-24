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

  if (shared.isConvertedUnit) {
    if (shared.availableLoading) {
      alertService.alert(
        'Please Wait',
        'Still calculating available quantity...',
      );
      return null;
    }
    if (
      shared.availableInSelectedUnit != null &&
      value > shared.availableInSelectedUnit
    ) {
      alertService.alert(
        'Error',
        `Cannot ${actionVerb} more than available quantity (${formatQuantity(
          shared.availableInSelectedUnit,
        )} ${shared.activeUnitSymbol})`,
      );
      return null;
    }
  } else if (value > shared.trackingQuantity) {
    alertService.alert(
      'Error',
      `Cannot ${actionVerb} more than available quantity (${shared.trackingQuantity} ${shared.activeUnitSymbol})`,
    );
    return null;
  }

  return value;
}
