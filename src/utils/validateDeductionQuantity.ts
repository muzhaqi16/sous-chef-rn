import { t } from '#/i18n';
// Interpolated keys — the module-level t takes a fallback, not options.
import { getI18n } from '#/i18n/config';
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
      t('labels.error'),
      actionVerb === 'waste'
        ? t('deduction.invalidWaste')
        : t('errors.invalidQuantity'),
    );
    return null;
  }

  if (shared.isConvertedUnit && shared.availableLoading) {
    alertService.alert(t('labels.pleaseWait'), t('deduction.stillCalculating'));
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
      t('labels.error'),
      getI18n().t(
        actionVerb === 'waste'
          ? 'deduction.exceedsAvailableWaste'
          : 'deduction.exceedsAvailableConsume',
        { amount: formatQuantity(cap), unit: shared.activeUnitSymbol },
      ),
    );
    return null;
  }

  return value;
}
