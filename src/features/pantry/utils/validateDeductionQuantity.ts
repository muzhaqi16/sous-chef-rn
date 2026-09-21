import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
  resolveQuantityNotation,
} from '#/utils/formatQuantity';
import type { PantryActionSharedState } from '#features/pantry/components/modals/PantryActionModal';

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

  const deduction = snapDeductionToCap(value, cap);
  if (deduction > cap) {
    alertService.alert(
      t('labels.error'),
      t(
        actionVerb === 'waste'
          ? 'deduction.exceedsAvailableWaste'
          : 'deduction.exceedsAvailableConsume',
        {
          amount: formatQuantityForDisplay(cap, {
            notation: resolveQuantityNotation(
              null,
              shared.displayAsFractionOf(shared.activeUnitId),
            ),
          }),
          unit: shared.activeUnitSymbol,
        },
      ),
    );
    return null;
  }

  return deduction;
}

/**
 * A deduction that READS as the cap is the cap. The seed's two notations
 * ("2.457" for 2.4566, "1/3" for 0.3338) are exact round trips and snap either
 * way; the display ("1 1/3" for 1.32) is ±0.02 wide, so it snaps only an amount
 * above the cap, never one below it.
 */
export function snapDeductionToCap(value: number, cap: number): number {
  const readsAsCap =
    value === cap ||
    formatQuantityForInput(value, { notation: 'decimal' }) ===
      formatQuantityForInput(cap, { notation: 'decimal' }) ||
    formatQuantityForInput(value) === formatQuantityForInput(cap) ||
    (value > cap &&
      formatQuantityForDisplay(value) === formatQuantityForDisplay(cap));
  return readsAsCap ? cap : value;
}
