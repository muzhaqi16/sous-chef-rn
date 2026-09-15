import { t } from '#/i18n';
import { alertService } from '#/services/alertService';
import { parseFractionalInput } from '#/utils/fractionUtils';
import {
  formatQuantityForDisplay,
  formatQuantityForInput,
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
          amount: formatQuantityForDisplay(cap),
          unit: shared.activeUnitSymbol,
        },
      ),
    );
    return null;
  }

  return deduction;
}

/**
 * A deduction that READS as the cap is the cap, whether read from a field seeded
 * with the whole stock ("2.457" for 2.4566, "1/3" for 0.3338) or from the stock
 * as displayed ("1 1/3" for 1.32). Only the seed's own two notations are exact
 * round trips: the display's fraction tolerance can disagree with either.
 */
export function snapDeductionToCap(value: number, cap: number): number {
  const capReadings = readings(cap);
  return readings(value).some(
    (reading, index) => reading === capReadings[index],
  )
    ? cap
    : value;
}

const readings = (quantity: number): string[] => [
  formatQuantityForInput(quantity, { notation: 'decimal' }),
  formatQuantityForInput(quantity),
  formatQuantityForDisplay(quantity),
];
